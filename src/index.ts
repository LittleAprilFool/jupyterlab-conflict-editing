import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { renderCellDecoration } from './cellDecoration';
import { ForkButtonExtension } from './forkButton';
import { ISessionContext } from '@jupyterlab/apputils';
import { OutputArea } from '@jupyterlab/outputarea';
import { IExecuteReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { JSONObject } from '@lumino/coreutils';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'conflic-editing:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension conflic-editing is activated!!!');
    app.docRegistry.addWidgetExtension('Notebook', new ForkButtonExtension());
    const executeFn = OutputArea.execute;

    // detect kernel information
    // inject magic cell command
    tracker.currentChanged.connect(onWidgetChange);
    tracker.currentWidget?.sessionContext.kernelChanged.connect(onKernelChange);

    // hijack cell execution event
    NotebookActions.executionScheduled.connect((_: any, output: any) => {
      if (output.cell.model.metadata.has('conflict_editing')) {
        const name = output.cell.model.metadata.get('conflict_editing').name;

        OutputArea.execute = (
          code: string,
          output: OutputArea,
          sessionContext: ISessionContext,
          metadata?: JSONObject | undefined
        ): Promise<IExecuteReplyMsg | undefined> => {
          let promise;

          try {
            // change the code cell value
            code = `%%private ${name}\n${code}`;

            promise = executeFn(code, output, sessionContext, metadata);
          } finally {
            OutputArea.execute = executeFn;
          }

          return promise;
        };
      }
    });
  }
};

const magicCode = `
from IPython.core.magic import (register_line_magic, register_cell_magic)

@register_cell_magic
def private(line, cell):
  name=line.split(" ")[0]
  content = f'class {name}:\\n'
  for line in cell.split('\\n'):
    content += f'\\t{line}\\n'
  content += f'{name}={name}()'
  exec(content, globals())
`;

const onKernelChange = (output: any) => {
  // this._sessionContext.session?.kernel?.requestExecute({
  //   code,
  // })
  console.log('Injecting cell magic');
  const kernel = output._session.kernel;
  const future = kernel.requestExecute({
    code: magicCode
  });
  future.onIOPub = (msg: any): void => {
    if (msg.msg_type === 'error') {
      console.log(msg);
    }
  };
};

const onWidgetChange = (tracker: INotebookTracker) => {
  console.log('onWidgetChange');
  tracker.currentWidget?.sessionContext.kernelChanged.connect(onKernelChange);
  tracker.currentWidget?.content?.model?.cells.changed.connect(onCellsChange);
  tracker.currentWidget?.context.ready.then(() => {
    // const cells = tracker.currentWidget?.content.model?.cells;
    const widgets = tracker.currentWidget?.content.widgets;
    console.log(tracker.currentWidget?.content.widgets);
    if (widgets) {
      for (let index = 0; index < (widgets.length || 0); index++) {
        const widget = widgets[index];
        renderCellDecoration(widget);
        // initPrivateCellDecoration(widget);
      }
    }
  });
};

const onCellsChange = (change: any) => {
  console.log('cell change');
};

export default plugin;
