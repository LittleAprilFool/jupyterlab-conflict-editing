import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { UseSignal } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';

import React, { useEffect } from 'react';
import { NotebookPanel } from '@jupyterlab/notebook';
import { getThisUser, logger } from '.';
import { EventType } from './logger';
interface ICollaborationComponentProps {
  cell: Cell | null;
  chat: any[];
  userlist: any[];
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
  chat,
  userlist,
  variable_inspec,
  notebook
}: ICollaborationComponentProps): JSX.Element => {
  // const [counter, setCounter] = useState(0);
  const activeCellRef = React.useRef<HTMLDivElement>(null);
  const messageInputRef = React.useRef<HTMLInputElement>(null);
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

  const clickVariableAccess = (e: any): any => {
    const parentNode: HTMLDivElement = e.target.parentNode as HTMLDivElement;
    parentNode.classList.toggle('visible');
  };

  const changeVariableAccess = (e: any): any => {
    logger.send(EventType.ChangeVariableAccess);
    const node = e.target;
    const newvariableList = JSON.parse(JSON.stringify(variable_inspec));
    newvariableList[node.dataset.vid].access = toggle(
      newvariableList[node.dataset.vid].access,
      userlist[node.dataset.uid].name
    );

    notebook?.model?.metadata.set('variable_inspec', newvariableList);
  };

  const sendMessage = () => {
    logger.send(EventType.SendChat);
    const messageList = notebook?.model?.metadata.get('chat');
    let newMessageList = [];
    if (messageList) {
      newMessageList = JSON.parse(JSON.stringify(messageList));
    }

    const newMessage = {
      sender: getThisUser(),
      content: messageInputRef.current?.value
    };

    newMessageList.push(newMessage);
    notebook?.model?.metadata.set('chat', newMessageList);
    if (messageInputRef.current) {
      messageInputRef.current.value = '';
    }
  };

  const getColor = (username: any) => {
    let color = '#aaa';
    userlist.forEach(user => {
      if (user.name === username) {
        color = user.color;
      }
    });
    return color;
  };

  return (
    <div className="widget-wrapper">
      <div className="section-wrapper">
        <div className="section-title">Active Users</div>
        <div className="section-content">
          <div className="users">
            {userlist.map(user => {
              return (
                <div
                  className={user.isCreator ? 'username iscreator' : 'username'}
                  style={{ borderLeftColor: user.color }}
                >
                  {user.name}
                </div>
              );
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
                                checked={variable.access.indexOf(user.name) < 0}
                                onClick={changeVariableAccess}
                                data-vid={vid}
                                data-uid={index}
                              />{' '}
                              {user.name}
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

      <div className="section-wrapper">
        <div className="section-title">Chat</div>
        <div className="section-content">
          <div className="chat-container">
            <div className="message-list">
              {chat.map(msg => {
                return (
                  <div className="msg-container">
                    <div
                      className="msg-sender"
                      style={{ color: getColor(msg.sender) }}
                    >
                      {msg.sender}
                    </div>
                    <div className="msg-content">{msg.content}</div>
                  </div>
                );
              })}
            </div>
            <div className="message-sender">
              <input
                ref={messageInputRef}
                className="message-input"
                type="text"
              />
              <button className="message-btn" onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
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
  notebook: NotebookPanel | null = null;
  userlist: any[] = [];
  variable_inspect: any[] = [];
  chat: any[] = [];
  updateWidget = new Signal<CollaborationWidget, ICollaborationComponentProps>(
    this
  );
  constructor() {
    super();
    this.addClass('jp-NotebookTools');
  }

  updateNotebook(notebook: NotebookPanel | null): any {
    this.notebook = notebook;
    const chat = notebook?.model?.metadata.get('chat');
    if (chat) {
      this.chat = chat as any;
    } else {
      this.chat = [];
    }

    const variable_inspect = notebook?.model?.metadata.get('variable_inspec');
    if (variable_inspect) {
      this.variable_inspect = variable_inspect as any;
    } else {
      this.variable_inspect = [];
    }
    console.log('update notebook', notebook, chat, variable_inspect);

    this.updateWidget.emit({
      cell: this.cell,
      chat: this.chat,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook
    });
  }

  updateCellSelection(cell: Cell): void {
    this.cell = cell;
    this.updateWidget.emit({
      cell: this.cell,
      chat: this.chat,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateInspectData(data: any): void {
    console.log('update inspect data in side widget', data);
    this.variable_inspect = data;
    this.updateWidget.emit({
      cell: this.cell,
      chat: this.chat,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateChatData(data: any): void {
    this.chat = data;
    this.updateWidget.emit({
      cell: this.cell,
      chat: this.chat,
      variable_inspec: this.variable_inspect,
      userlist: this.userlist,
      notebook: this.notebook
    });
  }

  updateUserList(userlist: any[]): void {
    if (this.userlist !== userlist) {
      this.userlist = userlist;
      this.updateWidget.emit({
        cell: this.cell,
        chat: this.chat,
        variable_inspec: this.variable_inspect,
        userlist: this.userlist,
        notebook: this.notebook
      });
    }
  }

  render(): React.ReactElement<any> {
    const init: ICollaborationComponentProps = {
      cell: null,
      chat: this.chat,
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
                chat={args?.chat ?? []}
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
