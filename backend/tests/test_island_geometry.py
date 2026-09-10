from app.game.island_geometry import (
    ISLAND_CENTER,
    SAFE_SPAWN,
    generate_island_geometry,
    point_is_inside_island,
)


def test_center_is_land_and_distant_point_is_water() -> None:
    coastline = generate_island_geometry(42)
    assert point_is_inside_island(SAFE_SPAWN, coastline)
    assert not point_is_inside_island((-10_000, -10_000), coastline)


def test_seeded_collision_geometry_is_deterministic() -> None:
    assert generate_island_geometry(123456) == generate_island_geometry(123456)
    assert generate_island_geometry(123456) != generate_island_geometry(654321)


def test_safe_spawn_is_inside_all_sampled_islands() -> None:
    assert SAFE_SPAWN == (ISLAND_CENTER, ISLAND_CENTER)
    for seed in (0, 1, 42, 999_999_999, 2**52 - 1):
        assert point_is_inside_island(SAFE_SPAWN, generate_island_geometry(seed))
