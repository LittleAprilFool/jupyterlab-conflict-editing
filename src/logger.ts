export enum EventType {
  OpenNotebook = 'open notebook',
  IndentCell = 'indent cell',
  UnindentCell = 'unindent cell',
  InsertToParallelGroup = 'insert into parallel group',
  ForkParallelCell = 'fork parallel group',
  SyncParallelKernel = 'sync parallel kernel',
  ChangeCellAccess = 'change cell access',
  ChangeVariableAccess = 'change variable access',
  SendChat = 'send chat message'
}

export interface ILogDataType {
  timestamp: string;
  sender: string;
  event: EventType;
}

export class Logger {
  private URL =
    'https://q420hu5q8f.execute-api.us-east-1.amazonaws.com/proxy-api-aws-edtech-labs-si-umich-edu/telemetry-edtech-labs-si-umich-edu/prod/OverJupyter';
  private http = new XMLHttpRequest();
  send(event: EventType) {
    const username = document.cookie
      .split('; ')
      ?.find(row => row.startsWith('hub_user='))
      ?.split('=')[1];
    const data = {
      timestamp: Date.now().toString(),
      sender: username,
      event
    };
    console.log('send to log', event, data);
    this.http.open('POST', this.URL, true);
    this.http.setRequestHeader('Content-type', 'application/json');
    this.http.send(JSON.stringify(data));
    return;
  }
}
