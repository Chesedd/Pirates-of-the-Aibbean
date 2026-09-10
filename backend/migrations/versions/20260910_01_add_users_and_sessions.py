"""Add users and server-side sessions."""
from alembic import op
import sqlalchemy as sa

revision = "20260910_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    role = sa.Enum("user", "admin", name="user_role")
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True),
                    sa.Column("username", sa.String(50), nullable=False),
                    sa.Column("password_hash", sa.String(255), nullable=False),
                    sa.Column("role", role, nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_table("user_sessions", sa.Column("token_hash", sa.String(64), primary_key=True),
                    sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_table("user_sessions")
    op.drop_table("users")
    sa.Enum("user", "admin", name="user_role").drop(op.get_bind(), checkfirst=True)
