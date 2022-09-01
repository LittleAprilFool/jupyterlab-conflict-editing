export const multiCodeScript = `
import sys
import ast
import pickle
import json
import _pickle as cPickle
import traceback

from io import StringIO 
from IPython.core.magic import (register_line_magic, register_cell_magic)

class _PrivateScope(object):
    def __init__(self, name):
        # list global variables
        self._name = name
        _executeCode('_global_vars = _filter_var(dir())')
        self._global_vars = _global_vars
        # make deepcopy of global variables
        return
    def _copyglobal(self):
        self._pre_content =  ''
        for variable in _global_vars:
            self._pre_content +=f'''try:
    {self._name}.{variable}=pickle.loads(cPickle.dumps({variable}, -1))
except:
    {self._name}._global_vars.remove('{variable}')\\n'''
        _executeCode(self._pre_content)
        return
        
    def _execute(self, code):
        # rewrite code
        # for every variable in the expression, we want to assign a prefix
        # april.test
        _executeCode(f'{self._name}._local_vars = _filter_var(dir({self._name}))\\n ')
        _executeCodeLocal(code, self._name, self._local_vars)
        return
    def __setitem__(self, key, value):
        setattr(self, key, value)

    def __getitem__(self, key):
        return getattr(self, key)

    def _sync(self):
        _executeCode('_global_vars = _filter_var(dir())')
        self._global_vars = _global_vars
        self._copyglobal()
        return

@register_cell_magic
def _parallelCell(line, cell):
    name='_'+line.split(" ")[0]
    variables=line.split(" ")[1:]
    exec(f'__code = """{cell}"""', globals())
    content = f"""if not "{name}" in dir():
    {name} = _PrivateScope('{name}')
    {name}._copyglobal()"""
    _executeCode(content)
    _executeCode(f'{name}._execute(__code)')
    
def _filter_var(names):
    return list(filter(lambda x: x[0]!='_', names))

def _vartoLocals(name, variables):
    content = '{'
    for variable in variables:
        content = content + f'"{variable}":{name}.{variable},'
    content = content[:-1]
    content = content + '}'
    return(content)
    
def _executeCode(content):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    
    # if the last line in content contains one variable, change it to display()
    content_lines = [i for i in content.split('\\n') if i]
    _exp = ast.parse(content_lines[-1].replace(" ", ""))
    nodes = [node for node in ast.walk(_exp)]
    if(len(nodes)==4 and isinstance(nodes[2], ast.Name)):
        content_lines[-1]=f'display({content_lines[-1]})'
    content = ('\\n').join(content_lines)
    
    # TODO: df.head() couldn't get printed out
    # execute the line
    # print(content)
    exec(content, globals())
    sys.stdout = old_stdout
    if(redirected_output.getvalue()):
        output = redirected_output.getvalue()
        if(output[-1] == '\\n'):
            output = output[:-1]
        print(output)
        
def _executeCodeLocal(content, name, variables):
    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()
    
    # if the last line in content contains one variable, change it to display()
    content_lines = [i for i in content.split('\\n') if i]
    _exp = ast.parse(content_lines[-1].replace(" ", ""))
    nodes = [node for node in ast.walk(_exp)]
    last_line = None
    if(len(nodes)==4 and isinstance(nodes[2], ast.Name)):
        content_lines[-1]=f'display({content_lines[-1]})'
        content = ('\\n').join(content_lines)
    else:
        content = ('\\n').join(content_lines)
        content = content + '\\n'

    # execute the line, pass variable remappings
    _locals = _vartoLocals(name, variables)
    code = f'''_locals = {_locals}
exec(\\'\\'\\'{content}\\'\\'\\', globals(), _locals)
for _key, _value in _locals.items():
    {name}[_key] = _value
'''
    try:
        exec(code, globals())
    except Exception:
        sys.stdout = old_stdout
        traceback.print_exc()
    sys.stdout = old_stdout
    if(redirected_output.getvalue()):
        output = redirected_output.getvalue()
        if(output[-1] == '\\n'):
            output = output[:-1]
        print(output)       
`;
