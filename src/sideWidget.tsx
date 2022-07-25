import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { UseSignal } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';

import React, { useEffect } from 'react';
import { NotebookPanel } from '@jupyterlab/notebook';

interface ICollaborationComponentProps {
  cell: Cell | null;
  access_meta: any;
  userlist: string[];
  variable_inspec: any[];
  notebook: NotebookPanel | null;
}

const toggle = (collection: string[], item: string) => {
  const idx = collection.indexOf(item);
  if (idx !== -1) {
    collection.splice(idx, 1);
  } else {
    collection.push(item);
  }
  return collection;
};

/**
 * React component for a counter.
 *
 * @returns The React component
 */
const CollaborationComponent = ({
  cell,
  access_meta,
  userlist,
  variable_inspec,
  notebook
}: ICollaborationComponentProps): JSX.Element => {
  // const [counter, setCounter] = useState(0);
  const activeCellRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeCellRef.current) {
      if (cell?.node) {
        const editor = cell?.node.querySelector('.jp-InputArea-editor');
        if (editor) {
          while (activeCellRef.current.lastChild) {
            activeCellRef.current.removeChild(activeCellRef.current.lastChild);
          }
          const newNode = editor.cloneNode(true);
          activeCellRef.current.appendChild(newNode);
        }
      }
    }
  }, [cell]);

  const changeAccess = (user: string, type: string): any => {
    let access = {
      edit: [] as string[],
      read: [] as string[]
    };
    if (cell) {
      if (access_meta) {
        access = JSON.parse(JSON.stringify(access_meta));
      }

      if (type === 'Edit') {
        access.edit = toggle(access.edit, user);
      }
      if (type === 'Read') {
        access.read = toggle(access.read, user);
      }
    }
    cell?.model.metadata.set('access_control', access);
  };

  const clickVariableAccess = (e: any): any => {
    const parentNode: HTMLDivElement = e.target.parentNode as HTMLDivElement;
    parentNode.classList.toggle('visible');
  };

  const changeVariableAccess = (e: any): any => {
    const node = e.target;
    const newvariableList = JSON.parse(JSON.stringify(variable_inspec));
    newvariableList[node.dataset.vid].access = toggle(
      newvariableList[node.dataset.vid].access,
      userlist[node.dataset.uid]
    );

    console.log(
      'change variable access',
      notebook?.model?.metadata.get('variable_inspec'),
      newvariableList
    );
    notebook?.model?.metadata.set('variable_inspec', newvariableList);
  };

  return (
    <div className="widget-wrapper">
      <div className="section-wrapper">
        <div className="section-title">Active Users</div>
        <div className="section-content">
          <div className="users">
            {userlist.map(user => {
              return <div className="username">{user}</div>;
            })}
          </div>
        </div>
      </div>

      <div className="section-wrapper">
        <div className="section-title">Selected Code Cell</div>
        <div className="section-content">
          <div ref={activeCellRef}></div>
        </div>
      </div>

      <div className="section-wrapper">
        <div className="section-title">Can Edit the Cell</div>
        <div className="section-content">
          <div className="users">
            {userlist.map(user => {
              return (
                <div>
                  <input
                    type="checkbox"
                    id={user}
                    name={user}
                    value={user}
                    checked={!access_meta.edit.includes(user)}
                    onChange={() => {
                      changeAccess(user, 'Edit');
                    }}
                  />
                  <label htmlFor={user}>{user}</label>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section-wrapper">
        <div className="section-title">Can Read the Cell</div>
        <div className="section-content">
          <div className="users">
            {userlist.map(user => {
              return (
                <div>
                  <input
                    type="checkbox"
                    id={user}
                    name={user}
                    value={user}
                    checked={!access_meta.read.includes(user)}
                    onChange={() => {
                      changeAccess(user, 'Read');
                    }}
                  />
                  <label htmlFor={user}>{user}</label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="section-wrapper">
        <div className="section-title">Variables</div>
        <div className="section-content">
          <table>
            <tr>
              <th>Name</th>
              <th>Type</th>
              {/* <th>Content</th> */}
              <th>Access</th>
            </tr>
            {variable_inspec.map((variable, vid) => {
              return (
                <tr>
                  <td>{variable.varName}</td>
                  <td>{variable.varType}</td>
                  {/* <td>{variable.varContent}</td> */}
                  <td>
                    <div className="dropdown-check-list">
                      <span className="anchor" onClick={clickVariableAccess}>
                        {variable.access.length === 0 ? 'Everyone' : 'Locked'}
                      </span>
                      <ul className="items">
                        {userlist.map((user, index) => {
                          return (
                            <li>
                              <input
                                type="checkbox"
                                checked={variable.access.indexOf(user) < 0}
                                onClick={changeVariableAccess}
                                data-vid={vid}
                                data-uid={index}
                              />{' '}
                              {user}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </td>
                </tr>
              );
            })}
          </table>
        </div>
      </div>

      {/* <div className="section-wrapper">
        <div className="section-title">Testing</div>
        <div className="section-content">
          <p>You clicked {counter} times!</p>
          <button
            onClick={(): void => {
              setCounter(counter + 1);
            }}
          >
            Increment
          </button>
        </div>
      </div> */}
    </div>
  );
};

/**
 * A Counter Lumino Widget that wraps a CounterComponent.
 */
export class CollaborationWidget extends ReactWidget {
  /**
   * Constructs a new CounterWidget.
   */
  cell: Cell | null = null;
  notebook: NotebookPanel | null = null;
  userlist: string[] = [];
  variable_inspect: any[] = [];
  updateWidget = new Signal<CollaborationWidget, ICollaborationComponentProps>(
    this
  );
  constructor() {
    super();
    this.addClass('jp-NotebookTools');
  }

  updateNotebook(notebook: NotebookPanel | null): any {
    console.log('update notebook');
    this.notebook = notebook;
    const access_meta = this.cell?.model.metadata.get('access_control') as any;
    this.updateWidget.emit({
      cell: this.cell,
      access_meta,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook
    });
  }

  updateCellSelection(cell: Cell): void {
    this.cell = cell;
    const access_meta = cell.model.metadata.get('access_control') as any;
    console.log('update cell selection');
    this.updateWidget.emit({
      cell: this.cell,
      access_meta,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateAccessData(data: any): void {
    console.log('update access data', data);
    this.updateWidget.emit({
      cell: this.cell,
      access_meta: data,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateInspectData(data: any): void {
    console.log('update inspect data', data);
    this.variable_inspect = data;
    const access_meta = this.cell?.model.metadata.get('access_control') as any;
    this.updateWidget.emit({
      cell: this.cell,
      access_meta,
      variable_inspec: data,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateUserList(userlist: string[]): void {
    if (this.userlist !== userlist) {
      this.userlist = userlist;
      const access_meta = this.cell?.model.metadata.get(
        'access_control'
      ) as any;
      this.updateWidget.emit({
        cell: this.cell,
        access_meta,
        variable_inspec: this.variable_inspect,
        userlist: this.userlist,
        notebook: this.notebook
      });
    }
  }

  render(): React.ReactElement<any> {
    const init: ICollaborationComponentProps = {
      cell: null,
      access_meta: { edit: [], read: [] },
      userlist: this.userlist,
      variable_inspec: this.variable_inspect,
      notebook: this.notebook
    };
    return (
      <React.Fragment>
        <UseSignal signal={this.updateWidget} initialArgs={init}>
          {(_, args): React.ReactElement<any> => {
            return (
              <CollaborationComponent
                cell={args?.cell ?? null}
                access_meta={args?.access_meta ?? { edit: [], read: [] }}
                variable_inspec={args?.variable_inspec ?? []}
                userlist={args?.userlist ?? []}
                notebook={args?.notebook ?? null}
              />
            );
          }}
        </UseSignal>
      </React.Fragment>
    );
  }
}
