"""Deliberately small evaluator for the four introductory journal exercises."""

import ast
import operator


class TutorialCodeError(ValueError):
    pass


OPERATORS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}
COMPARISONS = {ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge, ast.Eq: operator.eq, ast.NotEq: operator.ne}
Value = int | float | str | bool


def _value(node: ast.expr, variables: dict[str, Value]) -> Value:
    if isinstance(node, ast.Constant) and type(node.value) in (int, float, str, bool):
        return node.value
    if isinstance(node, ast.Name) and node.id in variables:
        return variables[node.id]
    if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
        left, right = _value(node.left, variables), _value(node.right, variables)
        if type(left) not in (int, float) or type(right) not in (int, float):
            raise TutorialCodeError("В арифметике разрешены только числа.")
        return OPERATORS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _value(node.operand, variables)
        if type(value) not in (int, float):
            raise TutorialCodeError("Знак можно поставить только перед числом.")
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.Compare) and len(node.ops) == len(node.comparators) == 1 and type(node.ops[0]) in COMPARISONS:
        return COMPARISONS[type(node.ops[0])](_value(node.left, variables), _value(node.comparators[0], variables))
    raise TutorialCodeError("Разрешены только значения, переменные, арифметика и простые сравнения.")


def _run_statements(statements: list[ast.stmt], variables: dict[str, Value], output: list[str], allow_if: bool) -> None:
    for statement in statements:
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
        if allow_if and isinstance(statement, ast.If):
            if statement.orelse:
                raise TutorialCodeError("Эта конструкция пока не изучена.\nПопробуй решить задачу только с помощью if.")
            if bool(_value(statement.test, variables)):
                _run_statements(statement.body, variables, output, allow_if=True)
            continue
        raise TutorialCodeError("Используйте присваивания, арифметику, print() и изученные конструкции.")


def run_tutorial_code(source: str, *, require_if: bool = False) -> str:
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as exc:
        raise TutorialCodeError(f"Ошибка синтаксиса: строка {exc.lineno}") from exc
    if require_if:
        if any(isinstance(node, ast.If) and node.orelse for node in ast.walk(tree)):
            raise TutorialCodeError("Эта конструкция пока не изучена.\nПопробуй решить задачу только с помощью if.")
        if not any(isinstance(node, ast.If) for node in ast.walk(tree)):
            raise TutorialCodeError("Используй if, чтобы действие выполнялось только при нужном условии.")

    variables: dict[str, Value] = {}
    output: list[str] = []
    _run_statements(tree.body, variables, output, allow_if=require_if)
    return "\n".join(output) + ("\n" if output else "")


EXPECTED_OUTPUT = {1: "14\n", 2: "17\n5\n", 3: "refill\n", 4: "light\n"}
