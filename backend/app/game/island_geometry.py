import math
from collections.abc import Callable

ISLAND_SIZE = 5200
ISLAND_CENTER = ISLAND_SIZE // 2
ISLAND_VERTEX_COUNT = 144
SAFE_SPAWN = (ISLAND_CENTER, ISLAND_CENTER)


def _u32(value: int) -> int:
    return value & 0xFFFFFFFF


def _imul(left: int, right: int) -> int:
    """The low 32 bits returned by JavaScript Math.imul."""
    return _u32(left * right)


def _seeded_random(seed: int) -> Callable[[], float]:
    # Keep this byte-for-byte algorithmically equivalent to frontend islandGeometry.ts.
    state = _u32(_u32(seed) ^ _u32(seed // 0x100000000))

    def random() -> float:
        nonlocal state
        state = _u32(state + 0x6D2B79F5)
        value = _imul(state ^ (state >> 15), 1 | state)
        value ^= _u32(value + _imul(value ^ (value >> 7), 61 | value))
        return _u32(value ^ (value >> 14)) / 4294967296

    return random


def generate_island_geometry(seed: int) -> list[tuple[float, float]]:
    """Generate the same coastline polygon rendered by the TypeScript client."""
    random = _seeded_random(seed)
    harmonics = [
        (index + 2, (0.075 if index < 3 else 0.035) * (0.7 + random() * 0.6), random() * math.tau)
        for index in range(9)
    ]
    stretch_x = 0.9 + random() * 0.13
    stretch_y = 0.84 + random() * 0.14
    rotation = (random() - 0.5) * 0.35
    coastline = []
    for index in range(ISLAND_VERTEX_COUNT):
        angle = index / ISLAND_VERTEX_COUNT * math.tau
        variation = sum(math.sin(angle * frequency + phase) * amplitude
                        for frequency, amplitude, phase in harmonics)
        radius = 2200 * max(0.68, min(1.16, 1 + variation))
        local_x = math.cos(angle) * radius * stretch_x
        local_y = math.sin(angle) * radius * stretch_y
        coastline.append((
            ISLAND_CENTER + local_x * math.cos(rotation) - local_y * math.sin(rotation),
            ISLAND_CENTER + local_x * math.sin(rotation) + local_y * math.cos(rotation),
        ))
    return coastline


def point_is_inside_island(point: tuple[float, float], coastline: list[tuple[float, float]]) -> bool:
    inside = False
    point_x, point_y = point
    previous = coastline[-1]
    for current in coastline:
        if ((current[1] > point_y) != (previous[1] > point_y)
                and point_x < (previous[0] - current[0]) * (point_y - current[1])
                / (previous[1] - current[1]) + current[0]):
            inside = not inside
        previous = current
    return inside


def position_is_on_island(seed: int, x: float, y: float) -> bool:
    return point_is_inside_island((x, y), generate_island_geometry(seed))
