import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { UseSignal } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';

import React, { useState } from 'react';

interface ICollaborationComponentProps {
  cell: Cell | null;
  access_meta: any;
  callback: any;
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
  callback,
  userlist
}: ICollaborationComponentProps): JSX.Element => {
  const [counter, setCounter] = useState(0);

  // const checkAccess = (user: string, type: string): boolean => {
  //   let flag = true;
  //   if (cell) {
  //     const access_meta = cell.model.metadata.get('access_control') as any;
  //     // const access_meta = access;
  //     if (access_meta) {
  //       if (type === 'Edit') {
  //         const edit_black = access_meta.edit;
  //         console.log('ues edit', user in edit_black);
  //         if (user in edit_black) {
  //           flag = false;
  //         }
  //       }
  //       if (type === 'Read') {
  //         const read_black = access_meta.read;
  //         if (user in read_black) {
  //           flag = false;
  //         }
  //       }
  //     }
  //     // console.log(user, type, access_meta);
  //     // console.log(flag);
  //     return flag;
  //   } else {
  //     // console.log(flag);
  //     return flag;
  //   }
  // };

  const changeAccess = (user: string, type: string): any => {
    let access = {
      edit: [] as string[],
      read: [] as string[]
    };
    if (cell) {
      const access_meta = cell.model.metadata.get('access_control') as any;
      if (access_meta) {
        access = access_meta;
      }

      if (type === 'Edit') {
        access.edit = toggle(access.edit, user);
      }
      if (type === 'Read') {
        access.read = toggle(access.read, user);
      }
    }
    console.log('set metadata - access control', access, cell);
    callback('haha');
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
        <div className="section-content">{cell?.model.value.text ?? ''}</div>
      </div>

      <div className="section-wrapper">
        <div>{'Edit:' + access_meta.edit}</div>
        <div>{'Read:' + access_meta.read}</div>
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
              callback(counter);
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
      callback: this.callback,
      userlist: this.userlist
    });
  }

  updateAccessData(data: any): void {
    console.log('update access data', data);
    this.updateWidget.emit({
      cell: this.cell,
      access_meta: data,
      callback: this.callback,
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
        callback: this.callback,
        userlist: this.userlist
      });
    }
  }

  callback(text: string): void {
    console.log(text, this.cell);
    this.cell?.model.metadata.set('access_control', {
      edit: [],
      read: []
    });
  }

  //   render(): JSX.Element {
  //     return <CollaborationComponent content={this.test} />;
  //   }
  render(): React.ReactElement<any> {
    const init: ICollaborationComponentProps = {
      cell: null,
      callback: this.callback.bind(this),
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
                callback={args?.callback.bind(this)}
                userlist={args?.userlist ?? []}
              />
            );
          }}
        </UseSignal>
      </React.Fragment>
    );
  }
}
