"""Small, deliberately limited evaluator for the journal exercises.

Tutorial programs never enter the player runtime.  Supporting only numeric
assignments, arithmetic and print also keeps submitted code away from Python
and game globals entirely.
"""

import ast
import operator


class TutorialCodeError(ValueError):
    pass


OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}


def _value(node: ast.expr, variables: dict[str, int | float]) -> int | float:
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.Name) and node.id in variables:
        return variables[node.id]
    if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
        return OPERATORS[type(node.op)](_value(node.left, variables), _value(node.right, variables))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _value(node.operand, variables)
        return value if isinstance(node.op, ast.UAdd) else -value
    raise TutorialCodeError("Разрешены только числа, переменные и арифметика.")


def run_tutorial_code(source: str) -> str:
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as exc:
        raise TutorialCodeError(f"Ошибка синтаксиса: строка {exc.lineno}") from exc

    variables: dict[str, int | float] = {}
    output: list[str] = []
    for statement in tree.body:
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1:
            target = statement.targets[0]
            if not isinstance(target, ast.Name):
                raise TutorialCodeError("Присваивать значения можно только переменным.")
            variables[target.id] = _value(statement.value, variables)
            continue
        if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
            call = statement.value
            if isinstance(call.func, ast.Name) and call.func.id == "print" and not call.keywords:
                output.append(" ".join(str(_value(argument, variables)) for argument in call.args))
                continue
        raise TutorialCodeError("Используйте присваивания, арифметику и print().")
    return "\n".join(output) + ("\n" if output else "")


EXPECTED_OUTPUT = {1: "14\n", 2: "17\n5\n"}
