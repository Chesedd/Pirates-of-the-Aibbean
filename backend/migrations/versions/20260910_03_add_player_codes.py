"""Add one player.py source document for every regular user."""
from alembic import op
import sqlalchemy as sa

revision = "20260910_03"
down_revision = "20260910_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "player_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_player_codes_user_id"),
    )
    op.create_index("ix_player_codes_user_id", "player_codes", ["user_id"], unique=True)
    op.execute(
        sa.text(
            "INSERT INTO player_codes (user_id, code) "
            "SELECT id, '' FROM users WHERE role = 'user' "
            "AND NOT EXISTS (SELECT 1 FROM player_codes WHERE player_codes.user_id = users.id)"
        )
    )


def downgrade() -> None:
    op.drop_table("player_codes")
