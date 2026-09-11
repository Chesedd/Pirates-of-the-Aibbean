"""AST allowlist and deliberately small evaluator for the tutorial exercises."""

import ast
import operator
from dataclasses import dataclass


class TutorialCodeError(ValueError):
    """An error that can be safely shown to a tutorial student."""


@dataclass(frozen=True)
class TutorialCapabilities:
    """Python constructs unlocked for a tutorial task."""

    assignment: bool = True
    arithmetic: bool = True
    print_call: bool = True
    comparisons: bool = False
    if_statement: bool = False


@dataclass(frozen=True)
class ConditionRule:
    """The exact shape of a comparison required by a tutorial task.

    A string value names another variable; numeric values are AST constants.
    """

    variable: str
    operator: str
    value: int | float | str


@dataclass(frozen=True)
class TutorialTask:
    """Declarative requirements for one tutorial exercise."""

    id: int
    capabilities: TutorialCapabilities
    required_variables: tuple[str, ...]
    expected_output: str
    require_if: bool = False
    variable_purposes: tuple[tuple[str, str], ...] = ()
    required_conditions: tuple[ConditionRule, ...] = ()


LINEAR_CAPABILITIES = TutorialCapabilities()
IF_CAPABILITIES = TutorialCapabilities(comparisons=True, if_statement=True)

TUTORIAL_TASKS = {
    1: TutorialTask(
        id=1,
        capabilities=LINEAR_CAPABILITIES,
        required_variables=("water", "food", "rations", "total"),
        expected_output="14\n",
        variable_purposes=(
            ("water", "для учёта воды на корабле"),
            ("food", "для учёта еды на корабле"),
            ("rations", "для учёта сухих пайков"),
            ("total", "для подсчёта всех припасов"),
        ),
    ),
    2: TutorialTask(
        id=2,
        capabilities=LINEAR_CAPABILITIES,
        required_variables=("x", "y"),
        expected_output="17\n5\n",
        variable_purposes=(("x", "для хранения координаты X"), ("y", "для хранения координаты Y")),
    ),
    3: TutorialTask(
        id=3,
        capabilities=IF_CAPABILITIES,
        required_variables=("water",),
        expected_output="refill\n",
        require_if=True,
        variable_purposes=(("water", "для управления запасами корабля"),),
        required_conditions=(ConditionRule(variable="water", operator="<", value=10),),
    ),
    4: TutorialTask(
        id=4,
        capabilities=IF_CAPABILITIES,
        required_variables=("fuel",),
        expected_output="light\n",
        require_if=True,
        variable_purposes=(("fuel", "для проверки топлива в сигнальном фонаре"),),
        required_conditions=(ConditionRule(variable="fuel", operator=">", value=0),),
    ),
}

ARITHMETIC_OPERATORS = (ast.Add, ast.Sub, ast.Mult, ast.Div)
COMPARISON_OPERATORS = (ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq)


class TutorialSyntaxValidator(ast.NodeVisitor):
    """Reject every syntax node not explicitly unlocked by the task."""

    def __init__(self, capabilities: TutorialCapabilities) -> None:
        self.capabilities = capabilities

    def visit_Module(self, node: ast.Module) -> None:  # noqa: N802 - AST visitor API
        for statement in node.body:
            self.visit(statement)

    def visit_Assign(self, node: ast.Assign) -> None:  # noqa: N802
        if not self.capabilities.assignment or len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            raise TutorialCodeError("Присваивать значения можно только одной переменной.")
        self.visit(node.value)

    def visit_Expr(self, node: ast.Expr) -> None:  # noqa: N802
        if not isinstance(node.value, ast.Call):
            raise TutorialCodeError("Отдельной командой пока можно вызывать только print().")
        self.visit(node.value)

    def visit_Constant(self, node: ast.Constant) -> None:  # noqa: N802
        if type(node.value) not in (int, float, str):
            raise TutorialCodeError("Пока доступны только числа и строки.")

    def visit_Name(self, node: ast.Name) -> None:  # noqa: N802
        # Variable names are deliberately unrestricted at this stage.
        return

    def visit_BinOp(self, node: ast.BinOp) -> None:  # noqa: N802
        if not self.capabilities.arithmetic or not isinstance(node.op, ARITHMETIC_OPERATORS):
            raise TutorialCodeError("Эта арифметическая операция пока не изучена.")
        self.visit(node.left)
        self.visit(node.right)

    def visit_UnaryOp(self, node: ast.UnaryOp) -> None:  # noqa: N802
        if not self.capabilities.arithmetic or not isinstance(node.op, ast.USub):
            raise TutorialCodeError("Эта арифметическая операция пока не изучена.")
        self.visit(node.operand)

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802
        function_name = node.func.id if isinstance(node.func, ast.Name) else None
        if function_name != "print" or not self.capabilities.print_call:
            shown_name = function_name or "эта функция"
            raise TutorialCodeError(f"Функция {shown_name} пока недоступна в этом задании.")
        if node.keywords:
            raise TutorialCodeError("Именованные аргументы print пока не изучены.")
        for argument in node.args:
            self.visit(argument)

    def visit_Compare(self, node: ast.Compare) -> None:  # noqa: N802
        if not self.capabilities.comparisons or not all(isinstance(op, COMPARISON_OPERATORS) for op in node.ops):
            raise TutorialCodeError("Сравнения пока не изучены.")
        self.visit(node.left)
        for comparator in node.comparators:
            self.visit(comparator)

    def visit_If(self, node: ast.If) -> None:  # noqa: N802
        if not self.capabilities.if_statement:
            raise TutorialCodeError(
                "Конструкция if пока не изучена.\n"
                "Попробуй решить эту задачу последовательными командами."
            )
        # Both ``else`` and ``elif`` are represented by a non-empty orelse.
        if node.orelse:
            raise TutorialCodeError(
                "Эта конструкция пока не изучена.\n"
                "Попробуй решить задачу только с помощью if."
            )
        self.visit(node.test)
        for statement in node.body:
            self.visit(statement)

    def visit_BoolOp(self, node: ast.BoolOp) -> None:  # noqa: N802
        raise TutorialCodeError(
            "На этой странице журнала нужен один простой сигнал.\n"
            "Условия с and и or пока не изучены."
        )

    def visit_For(self, node: ast.For) -> None:  # noqa: N802
        self._reject_loop()

    def visit_While(self, node: ast.While) -> None:  # noqa: N802
        self._reject_loop()

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:  # noqa: N802
        self._reject_loop()

    @staticmethod
    def _reject_loop() -> None:
        raise TutorialCodeError("Циклы пока не открыты.\nПопробуй решить задачу без for и while.")

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802
        self._reject_function()

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:  # noqa: N802
        self._reject_function()

    def visit_Lambda(self, node: ast.Lambda) -> None:  # noqa: N802
        self._reject_function()

    @staticmethod
    def _reject_function() -> None:
        raise TutorialCodeError("Создание функций пока не изучено.")

    def generic_visit(self, node: ast.AST) -> None:
        raise TutorialCodeError("Эта конструкция Python пока не изучена.")


def parse_and_validate(source: str, capabilities: TutorialCapabilities) -> ast.Module:
    """Parse source once and validate it before any evaluation takes place."""
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError as exc:
        message = "В коде есть синтаксическая ошибка.\nПроверь двоеточия, скобки и отступы."
        if exc.lineno is not None:
            message += f"\nСтрока {exc.lineno}."
        raise TutorialCodeError(message) from exc
    TutorialSyntaxValidator(capabilities).visit(tree)
    return tree


def validate_required_variables(tree: ast.Module, task: TutorialTask) -> None:
    """Ensure required names occur in the AST and receive a value before execution."""
    loaded = {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load)
    }
    assigned = {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store)
    }
    purposes = dict(task.variable_purposes)
    condition_variables = {rule.variable for rule in task.required_conditions}
    has_if = any(isinstance(node, ast.If) for node in ast.walk(tree))

    for name in task.required_variables:
        if name not in loaded and name not in assigned:
            # For an if exercise, the condition validator can give a much more
            # useful explanation when a different stock is being inspected.
            if has_if and name in condition_variables:
                continue
            purpose = purposes.get(name, "для этой записи в журнале капитана")
            raise TutorialCodeError(
                "Кажется, ты решил задачу другим способом.\n\n"
                f"Попробуй использовать переменную {name} —\nона нужна {purpose}."
            )
        if name not in assigned:
            raise TutorialCodeError(f"Переменная {name} пока не получила значение.\nСначала создай её.")


CONDITION_OPERATOR_TYPES = {
    "<": ast.Lt,
    ">": ast.Gt,
    "<=": ast.LtE,
    ">=": ast.GtE,
    "==": ast.Eq,
    "!=": ast.NotEq,
}


def validate_required_conditions(tree: ast.Module, task: TutorialTask) -> None:
    """Compare required if conditions directly against the parsed AST."""
    if not task.required_conditions:
        return

    if_nodes = [node for node in ast.walk(tree) if isinstance(node, ast.If)]
    if len(if_nodes) != 1:
        raise TutorialCodeError(
            "В этой задаче нужен один сигнал проверки.\n"
            "Попробуй решить её одним условием."
        )
    if len(task.required_conditions) != 1:
        raise ValueError("A single-if tutorial task must define exactly one condition rule")

    condition = if_nodes[0].test
    rule = task.required_conditions[0]
    if (
        not isinstance(condition, ast.Compare)
        or len(condition.ops) != 1
        or len(condition.comparators) != 1
        or not isinstance(condition.left, ast.Name)
        or not isinstance(condition.comparators[0], (ast.Name, ast.Constant))
        or (
            isinstance(condition.comparators[0], ast.Constant)
            and type(condition.comparators[0].value) not in (int, float)
        )
    ):
        raise TutorialCodeError(
            "Курс проложен слишком сложным условием.\n"
            "Сравни одну переменную с числом или другой переменной."
        )

    if condition.left.id != rule.variable:
        raise TutorialCodeError(
            "Кажется, ты проверяешь не тот запас.\n\n"
            "Для этой задачи нужно следить за количеством воды."
            if rule.variable == "water"
            else "Кажется, ты проверяешь не тот запас.\n\n"
            f"Для этой задачи нужно следить за переменной {rule.variable}."
        )

    expected_operator = CONDITION_OPERATOR_TYPES.get(rule.operator)
    if expected_operator is None:
        raise ValueError(f"Unsupported tutorial condition operator: {rule.operator}")
    if type(condition.ops[0]) is not expected_operator:
        raise TutorialCodeError(
            "Условие работает наоборот.\n\n"
            "Проверь, когда именно нужно пополнить запас."
        )

    right = condition.comparators[0]
    actual_value: int | float | str = right.id if isinstance(right, ast.Name) else right.value
    # Compare types as well as values: True must not silently stand in for 1.
    if type(actual_value) is not type(rule.value) or actual_value != rule.value:
        raise TutorialCodeError(
            "Порог запаса выбран неправильно.\n\n"
            "Посмотри условия задания ещё раз."
        )


OPERATORS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}
COMPARISONS = {ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge, ast.Eq: operator.eq, ast.NotEq: operator.ne}
Value = int | float | str | bool


def _value(node: ast.expr, variables: dict[str, Value]) -> Value:
    if isinstance(node, ast.Constant) and type(node.value) in (int, float, str):
        return node.value
    if isinstance(node, ast.Name) and node.id in variables:
        return variables[node.id]
    if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
        left, right = _value(node.left, variables), _value(node.right, variables)
        if type(left) not in (int, float) or type(right) not in (int, float):
            raise TutorialCodeError("В арифметике разрешены только числа.")
        return OPERATORS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        value = _value(node.operand, variables)
        if type(value) not in (int, float):
            raise TutorialCodeError("Знак можно поставить только перед числом.")
        return -value
    if isinstance(node, ast.Compare) and len(node.ops) == len(node.comparators) == 1 and type(node.ops[0]) in COMPARISONS:
        return COMPARISONS[type(node.ops[0])](_value(node.left, variables), _value(node.comparators[0], variables))
    raise TutorialCodeError("Разрешены только значения, переменные, арифметика и простые сравнения.")


def _run_statements(statements: list[ast.stmt], variables: dict[str, Value], output: list[str], allow_if: bool) -> None:
    for statement in statements:
        if isinstance(statement, ast.Assign):
            target = statement.targets[0]
            assert isinstance(target, ast.Name)  # guaranteed by TutorialSyntaxValidator
            variables[target.id] = _value(statement.value, variables)
        elif isinstance(statement, ast.Expr):
            call = statement.value
            assert isinstance(call, ast.Call)  # guaranteed by TutorialSyntaxValidator
            output.append(" ".join(str(_value(argument, variables)) for argument in call.args))
        elif allow_if and isinstance(statement, ast.If):
            if bool(_value(statement.test, variables)):
                _run_statements(statement.body, variables, output, allow_if=True)


def run_tutorial_code(
    source: str, *, require_if: bool = False, task: TutorialTask | None = None
) -> str:
    capabilities = (
        task.capabilities
        if task is not None
        else (IF_CAPABILITIES if require_if else LINEAR_CAPABILITIES)
    )
    tree = parse_and_validate(source, capabilities)
    if task is not None:
        validate_required_variables(tree, task)
    needs_if = task.require_if if task is not None else require_if
    if needs_if and not any(isinstance(node, ast.If) for node in ast.walk(tree)):
        raise TutorialCodeError("Используй if, чтобы действие выполнялось только при нужном условии.")
    if task is not None:
        validate_required_conditions(tree, task)

    variables: dict[str, Value] = {}
    output: list[str] = []
    _run_statements(tree.body, variables, output, allow_if=needs_if)
    return "\n".join(output) + ("\n" if output else "")
