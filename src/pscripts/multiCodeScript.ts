export const multiCodeScript = `
## Now create a class

class PrivateScope:
    def __prerun__(self, __code, __scope):
        if (__scope==None):
            exec(__code)
            result = eval("locals().keys()")
        else:
            exec(__code, __scope)
            result = eval("locals().keys()", __scope)
        return result
    def __run__(self, __code, __scope):
        if __scope==None:
            exec(__code)
        else:
            exec(__code, __scope)
    def __locals__(self):
        return eval("locals().keys()")

import sys
from io import StringIO 

class NullIO(StringIO):
    def write(self, txt):
       pass

def rewriteCode(code, variables):
    content = code + '\\n'
    for variable in variables:
        content +=f'self.{variable}={variable}\\n'
    return content

def getCleanList(lst):
    return list(filter(lambda a: a[0]!='_' and a!='self', lst))

import json

def attrtoLocals(attrs, model):
    content = '{'
    if len(attrs) == 0:
        return 'None'
    else:
        for attr in attrs:
            content = content + f'"{attr}":{model}.{attr},'
        content = content + f'"self":{model}'
        content = content + '}'
    return(content)

from IPython.core.magic import (register_line_magic, register_cell_magic)
@register_cell_magic
def privateMulti(line, cell):
    name=line.split(" ")[0]
    variables=line.split(" ")[1:]
    exec(f'__code = """{cell}"""', globals())
    content = f"""
if not "{name}" in locals():
  {name} = PrivateScope()
_pre_attr = getCleanList(dir({name}))
_pre_locals = attrtoLocals(_pre_attr, "{name}")
"""
    exec(content, globals())
    content = f"""
nb_stdout = sys.stdout
sys.stdout = NullIO()
exec('_post_attrs = {name}.__prerun__(__code, {_pre_locals})')
sys.stdout = nb_stdout
_post_attrs = getCleanList(_post_attrs)
_code_rewrite = rewriteCode(__code, _post_attrs)
exec('{name}.__run__(_code_rewrite, {_pre_locals})')
"""
    exec(content, globals())       
`;
