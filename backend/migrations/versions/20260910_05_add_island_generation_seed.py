"""Add persistent procedural generation seeds to islands."""

import secrets

from alembic import op
import sqlalchemy as sa

revision = "20260910_05"
down_revision = "20260910_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("islands", sa.Column("generation_seed", sa.BigInteger(), nullable=True))
    connection = op.get_bind()
    island_ids = connection.execute(sa.text("SELECT id FROM islands ORDER BY id")).scalars()
    used: set[int] = set()
    for island_id in island_ids:
        seed = secrets.randbits(52)
        while seed in used:
            seed = secrets.randbits(52)
        used.add(seed)
        connection.execute(
            sa.text("UPDATE islands SET generation_seed = :seed, player_x = 2600, player_y = 2600 WHERE id = :id"),
            {"seed": seed, "id": island_id},
        )
    op.create_unique_constraint("uq_islands_generation_seed", "islands", ["generation_seed"])
    op.alter_column("islands", "generation_seed", nullable=False)
    op.alter_column("islands", "player_x", server_default="2600")
    op.alter_column("islands", "player_y", server_default="2600")


def downgrade() -> None:
    op.alter_column("islands", "player_y", server_default="300")
    op.alter_column("islands", "player_x", server_default="400")
    op.drop_constraint("uq_islands_generation_seed", "islands", type_="unique")
    op.drop_column("islands", "generation_seed")
