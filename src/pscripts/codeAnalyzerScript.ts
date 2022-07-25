export const codeAnalyzerScript = `
import ast
from pprint import pprint

def analyze(code):
    tree = ast.parse(code)
    analyzer = Analyzer()
    analyzer.visit(tree)
    # analyzer.report()


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
