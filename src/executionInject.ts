/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import _ from 'lodash';

import { NotebookActions } from '@jupyterlab/notebook';

import { ISessionContext } from '@jupyterlab/apputils';
import { IExecuteReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { JSONObject } from '@lumino/coreutils';
import { OutputArea } from '@jupyterlab/outputarea';

import { Session } from '@jupyterlab/services';
import { variableScript } from './pscripts/variableScript';
import { multiCodeScript } from './pscripts/multiCodeScript';
import { codeAnalyzerScript } from './pscripts/codeAnalyzerScript';
import { forkCellScript } from './pscripts/forkCellScript';
import { showDialog } from '@jupyterlab/apputils';
export class ExecutionInject {
  private session: Session.ISessionConnection | null = null;
  private blockedVariable: any[] = [];
  init(session: Session.ISessionConnection) {
    this.session = session;
    // TODO: check if the magic code is already inserted by a collaborator
    this.changeExecutionMethod();
    this.injectMagicCode();
    return;
  }

  changeExecutionMethod() {
    const executeFn = OutputArea.execute;
    // hijack cell execution event
    NotebookActions.executionScheduled.connect((_: any, output: any) => {
      if (output.cell.model.metadata.has('conflict_editing')) {
        const name = output.cell.model.metadata.get('conflict_editing').name;
        const ismain =
          output.cell.model.metadata.get('conflict_editing').ismain;
        OutputArea.execute = async (
          code: string,
          output: OutputArea,
          sessionContext: ISessionContext,
          metadata?: JSONObject | undefined
        ): Promise<IExecuteReplyMsg | undefined> => {
          let promise;
          try {
            if (!ismain) {
              code = `%%_parallelCell ${name} \n${code}`;
            }
            // TODO: add self to function definition
            promise = executeFn(code, output, sessionContext, metadata);
          } finally {
            OutputArea.execute = executeFn;
          }
          return promise;
        };
      } else {
        OutputArea.execute = async (
          code: string,
          output: OutputArea,
          sessionContext: ISessionContext,
          metadata?: JSONObject | undefined
        ): Promise<IExecuteReplyMsg | undefined> => {
          let promise;
          try {
            let flag = true;
            let vname = null;
            this.blockedVariable.forEach(variable => {
              if (code.indexOf(variable.varName) >= 0) {
                flag = false;
                vname = variable.varName;
              }
            });
            if (flag) {
              promise = executeFn(code, output, sessionContext, metadata);
            } else {
              showDialog({
                title: 'No access to the variable',
                body: `Can't edit the variable ${vname}`
              });
              // alert("Can't edit the variable " + vname);
              promise = executeFn('', output, sessionContext, metadata);
            }
          } finally {
            OutputArea.execute = executeFn;
          }
          return promise;
        };
      }
    });
    NotebookActions.selectionExecuted.connect((_: any, output: any) => {
      if (this.session?.kernel) {
        const kernel = this.session.kernel;
        const future = kernel?.requestExecute({
          code: '_jupyterlab_variableinspector_dict_list()'
        });
        future.onIOPub = (msg: any): void => {
          if (msg.msg_type === 'error') {
            console.log(msg);
          }
          if (msg.msg_type === 'execute_result') {
            let data = msg.content.data['text/plain'];
            data = data.slice(1, data.length - 1);
            data = data.split('\\').join('');
            const variable_inspec = JSON.parse(data);

            const old_variable =
              output.notebook.model.metadata.get('variable_inspec');
            variable_inspec.forEach((variable: any, index: number) => {
              if (!old_variable) {
                variable_inspec[index].access = [];
              } else {
                const isOld = old_variable.filter(
                  (x: any) => x.varName === variable.varName
                );
                if (isOld.length > 0) {
                  variable_inspec[index].access = isOld[0].access;
                } else {
                  variable_inspec[index].access = [];
                }
              }
            });

            if (!old_variable || !isSame(variable_inspec, old_variable)) {
              output.notebook.model.metadata.set(
                'variable_inspec',
                variable_inspec
              );
            }
          }
        };
      }
    });
  }

  injectMagicCode(output?: any) {
    // this._sessionContext.session?.kernel?.requestExecute({
    //   code,
    // })
    if (output) {
      this.session = output._session;
    }
    if (this.session?.kernel) {
      const kernel = this.session.kernel;
      const future = kernel?.requestExecute({
        code:
          codeAnalyzerScript + forkCellScript + multiCodeScript + variableScript
      });
      future.onIOPub = (msg: any): void => {
        if (msg.msg_type === 'error') {
          console.log(msg);
        }
      };
    }
  }

  updateBlockedVariable(blockedVariable: any[]) {
    this.blockedVariable = blockedVariable;
  }
}

const isSame = (array1: any[], array2: any[]) => {
  const is_same =
    array1.length === array2.length &&
    array1.every((element, index) => {
      return _.isEqual(element, array2[index]);
    });
  return is_same;
};
