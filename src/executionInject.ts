/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NotebookActions } from '@jupyterlab/notebook';

import { ISessionContext } from '@jupyterlab/apputils';
import { IExecuteReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { JSONObject } from '@lumino/coreutils';
import { OutputArea } from '@jupyterlab/outputarea';

import { Session } from '@jupyterlab/services';

const analyzeCode = `
import ast
from pprint import pprint

def analyze(code):
    tree = ast.parse(code)
    analyzer = Analyzer()
    analyzer.visit(tree)
    analyzer.report()


class Analyzer(ast.NodeVisitor):
    def __init__(self):
        self.stats = {"variable": []}
        
    def visit_Name(self, node):
        # self.stats["variable"].append(node.id)
        self.generic_visit(node)
    
    def visit_Assign(self, node):
        for target in node.targets:
            if(type(target) == ast.Name):
                self.stats["variable"].append(target.id)
            if(type(target) == ast.Subscript):
                self.stats["variable"].append(target.value.id)
        self.generic_visit(node)
        
    def visit_Expr(self, node):
        if(type(node.value)==ast.Call and type(node.value.func) == ast.Attribute):
            self.stats["variable"].append(node.value.func.value.id)
        self.generic_visit(node)

    def report(self):
        pprint(self.stats)
`;

const magicCode = `
from IPython.core.magic import (register_line_magic, register_cell_magic)
import copy
import re

@register_cell_magic
def private(line, cell):
  name=line.split(" ")[0]
  variables=line.split(" ")[1:]

  content = f'class {name}:\\n'
  for variable in variables:
    content +=f'\\t{variable}=copy.deepcopy({variable})\\n'
  for line in cell.split('\\n'):
    pattern=r'def .*\(.*\):'
    match = re.search(pattern, line)
    if(match):
      l = line.split('(')
      if(l[1][0]==')'):
        newl = l[0] + '(self'+ "".join(l[1:])
      else:
        newl = l[0] + '(self,' + "".join(l[1:])
      line = newl
    content += f'\\t{line}\\n'
  content += f'{name}={name}()'
  exec(content, globals())

@register_cell_magic
def privateMain(line, cell):
  name=line.split(" ")[0]
  variables=line.split(" ")[1:]

  content = f'class {name}:\\n'
  for variable in variables:
    content +=f'\\t{variable}=copy.deepcopy({variable})\\n'
  for line in cell.split('\\n'):
    pattern=r'def .*\(.*\):'
    match = re.search(pattern, line)
    if(match):
      l = line.split('(')
      if(l[1][0]==')'):
        newl = l[0] + '(self'+ "".join(l[1:])
      else:
        newl = l[0] + '(self,' + "".join(l[1:])
      line = newl
    content += f'\\t{line}\\n'
  content += f'{name}={name}()'
  exec(content, globals())
  for variable in variables:
    exec(f'{variable} = {name}.{variable}', globals())
`;

export class ExecutionInject {
  private session: Session.ISessionConnection | null = null;
  init(session: Session.ISessionConnection) {
    console.log('Init the ExecutionInject component', session);
    this.session = session;
    this.changeExecutionMethod();
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
            let variables: string[] = [];
            // first, execute analyzer to detect what variables are used in the function
            // this should be executed before executionScheduled...
            if (this.session?.kernel) {
              const kernel = this.session.kernel;
              if (kernel) {
                const future = kernel.requestExecute({
                  code: `analyze("""${code}""")`
                });
                future.onIOPub = (msg: any): void => {
                  if (msg.msg_type === 'error') {
                    console.log(msg);
                  }
                  if (msg.msg_type === 'stream') {
                    variables = parseVariable(msg.content.text);
                  }
                };
                await future.done;
              }
            }

            if (variables.length > 0) {
              if (ismain) {
                code = `%%privateMain ${name} ${variables.join(' ')}\n${code}`;
              } else {
                code = `%%private ${name} ${variables.join(' ')}\n${code}`;
              }
            } else {
              // change the code cell value
              if (ismain) {
                code = `%%privateMain ${name}\n${code}`;
              } else {
                code = `%%private ${name}\n${code}`;
              }
            }
            // TODO: add self to function definition
            promise = executeFn(code, output, sessionContext, metadata);
          } finally {
            OutputArea.execute = executeFn;
          }
          return promise;
        };
      }
    });
  }

  injectMagicCode(output: any) {
    // this._sessionContext.session?.kernel?.requestExecute({
    //   code,
    // })
    this.session = output._session;
    if (this.session) {
      console.log('Injecting cell magic');
      const kernel = output._session.kernel;
      const future = kernel.requestExecute({
        code: analyzeCode + magicCode
      });
      future.onIOPub = (msg: any): void => {
        if (msg.msg_type === 'error') {
          console.log(msg);
        }
      };
    }
  }
}

const parseVariable = (text: string) => {
  const replaced = text.split("'").join('"');
  const result = JSON.parse(replaced);
  const unique = [...new Set(result.variable)] as string[];

  return unique;
};
