/* eslint-disable no-useless-escape */
export const forkCellScript = `
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
