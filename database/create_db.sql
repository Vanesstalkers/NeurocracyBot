DROP TABLE IF EXISTS "users";
CREATE TABLE "public"."users" (
    "id" bigint NOT NULL,
    "data" jsonb NOT NULL,
    "last_login" timestamp NOT NULL,
    "telegram" jsonb,
    CONSTRAINT "users_id" PRIMARY KEY ("id")
) WITH (oids = false);