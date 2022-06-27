import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { UseSignal } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';

import React, { useState, useEffect } from 'react';

interface ICollaborationComponentProps {
  cell: Cell | null;
  access_meta: any;
  userlist: string[];
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
  userlist
}: ICollaborationComponentProps): JSX.Element => {
  const [counter, setCounter] = useState(0);
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
      </div>
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
  userlist: string[] = [];
  updateWidget = new Signal<CollaborationWidget, ICollaborationComponentProps>(
    this
  );
  constructor() {
    super();
    this.addClass('jp-NotebookTools');
  }

  updateCellSelection(cell: Cell): void {
    this.cell = cell;
    const access_meta = cell.model.metadata.get('access_control') as any;
    console.log('update cell selection');
    this.updateWidget.emit({
      cell: this.cell,
      access_meta,
      userlist: this.userlist
    });
  }

  updateAccessData(data: any): void {
    console.log('update access data', data);
    this.updateWidget.emit({
      cell: this.cell,
      access_meta: data,
      userlist: this.userlist
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
        userlist: this.userlist
      });
    }
  }

  render(): React.ReactElement<any> {
    const init: ICollaborationComponentProps = {
      cell: null,
      access_meta: { edit: [], read: [] },
      userlist: this.userlist
    };
    return (
      <React.Fragment>
        <UseSignal signal={this.updateWidget} initialArgs={init}>
          {(_, args): React.ReactElement<any> => {
            return (
              <CollaborationComponent
                cell={args?.cell ?? null}
                access_meta={args?.access_meta ?? { edit: [], read: [] }}
                userlist={args?.userlist ?? []}
              />
            );
          }}
        </UseSignal>
      </React.Fragment>
    );
  }
}
