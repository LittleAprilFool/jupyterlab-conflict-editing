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

export class ExecutionInject {
  private session: Session.ISessionConnection | null = null;
  private blockedVariable: any[] = [];
  init(session: Session.ISessionConnection) {
    console.log('Init the ExecutionInject component', session);
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
            // let variables: string[] = [];
            // let variables_glob: string[] = [];
            // let variables_local: string[] = [];

            // first, execute analyzer to detect what variables are used in the function
            // this should be executed before executionScheduled...
            // if (this.session?.kernel) {
            //   const kernel = this.session.kernel;
            //   if (kernel) {
            //     const future = kernel.requestExecute({
            //       code: `analyze("""${code}""")`
            //     });
            //     future.onIOPub = (msg: any): void => {
            //       if (msg.msg_type === 'error') {
            //         console.log(msg);
            //       }
            //       if (msg.msg_type === 'stream') {
            //         variables_local = parseVariable(msg.content.text);
            //       }
            //     };
            //     await future.done;

            //     const future2 = kernel.requestExecute({
            //       code: 'dir()'
            //     });
            //     future2.onIOPub = (msg: any): void => {
            //       if (msg.msg_type === 'error') {
            //         console.log(msg);
            //       }
            //       if (msg.msg_type === 'execute_result') {
            //         variables_glob = parseGlobalVariable(
            //           msg.content.data['text/plain']
            //         );
            //       }
            //     };
            //     await future2.done;
            //     variables = variables_local.filter(x =>
            //       variables_glob.includes(x)
            //     );
            //   }
            // }

            if (!ismain) {
              code = `%%_parallelCell ${name} \n${code}`;
            }

            // if (variables.length > 0) {
            //   if (!ismain) {
            //     code = `%%_parallelCell _${name} \n${code}`;
            //   }
            // } else {
            //   // change the code cell value
            //   if (!ismain) {
            //     code = `%%_parallelCell _${name}\n${code}`;
            //   }
            // }
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
            console.log(
              'check if this user is allowed to change the value of the variable'
            );
            let flag = true;
            let vname = null;
            this.blockedVariable.forEach(variable => {
              if (code.indexOf(variable.varName) >= 0) {
                flag = false;
                vname = variable.varName;
              }
            });
            console.log(code, this.blockedVariable, flag);
            if (flag) {
              promise = executeFn(code, output, sessionContext, metadata);
            } else {
              alert("Can't edit the variable " + vname);
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
      console.log('selection executed');
      if (this.session?.kernel) {
        const kernel = this.session.kernel;
        const future = kernel?.requestExecute({
          code: '_jupyterlab_variableinspector_dict_list()'
        });
        future.onIOPub = (msg: any): void => {
          console.log(msg);
          if (msg.msg_type === 'error') {
            console.log(msg);
          }
          if (msg.msg_type === 'execute_result') {
            console.log(msg.content.data['text/plain']);
            let data = msg.content.data['text/plain'];
            data = data.slice(1, data.length - 1);
            data = data.split('\\').join('');
            console.log(data);
            const variable_inspec = JSON.parse(data);
            console.log(variable_inspec);

            const old_variable =
              output.notebook.model.metadata.get('variable_inspec');
            variable_inspec.forEach((variable: any, index: number) => {
              const isOld = old_variable.filter(
                (x: any) => x.varName === variable.varName
              );
              if (isOld.length > 0) {
                variable_inspec[index].access = isOld[0].access;
              } else {
                variable_inspec[index].access = [];
              }
            });
            console.log(
              'before comparing variable inspec',
              variable_inspec,
              old_variable
            );
            if (!isSame(variable_inspec, old_variable)) {
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
      console.log('Injecting cell magic');
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

// const parseVariable = (text: string) => {
//   const replaced = text.split("'").join('"');
//   const result = JSON.parse(replaced);
//   const unique = [...new Set(result.variable)] as string[];

//   return unique;
// };

// const parseGlobalVariable = (text: string) => {
//   const replaced = text.split("'").join('"');
//   const result = JSON.parse(replaced);
//   const unique = [...new Set(result)] as string[];
//   return unique;
// };

const isSame = (array1: any[], array2: any[]) => {
  const is_same =
    array1.length === array2.length &&
    array1.every((element, index) => {
      return _.isEqual(element, array2[index]);
    });
  return is_same;
};
