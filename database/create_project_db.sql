DROP TABLE IF EXISTS "answer";
DROP SEQUENCE IF EXISTS answer_id_seq;
CREATE SEQUENCE answer_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."answer" (
    "id" integer DEFAULT nextval('answer_id_seq') NOT NULL,
    "user_id" bigint NOT NULL,
    "question_id" integer NOT NULL,
    "data" jsonb NOT NULL,
    "add_time" timestamp NOT NULL,
    "delete_time" timestamp,
    "msg_id" bigint,
    "chat_id" bigint,
    CONSTRAINT "answer_question_id_user_id" UNIQUE ("question_id", "user_id"),
    CONSTRAINT "answer_question_id_fkey" FOREIGN KEY (question_id) REFERENCES question(id) NOT DEFERRABLE,
    CONSTRAINT "answer_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) NOT DEFERRABLE
) WITH (oids = false);


DROP TABLE IF EXISTS "question";
DROP SEQUENCE IF EXISTS question_id_seq;
CREATE SEQUENCE question_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."question" (
    "id" integer DEFAULT nextval('question_id_seq') NOT NULL,
    "user_id" bigint NOT NULL,
    "data" jsonb NOT NULL,
    "add_time" timestamp NOT NULL,
    "delete_time" timestamp,
    "msg_id" bigint,
    "chat_id" bigint,
    CONSTRAINT "question_id" PRIMARY KEY ("id"),
    CONSTRAINT "question_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) NOT DEFERRABLE
) WITH (oids = false);


DROP TABLE IF EXISTS "user_alert";
DROP SEQUENCE IF EXISTS user_alert_id_seq;
CREATE SEQUENCE user_alert_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1;

CREATE TABLE "public"."user_alert" (
    "id" integer DEFAULT nextval('user_alert_id_seq') NOT NULL,
    "user_id" bigint NOT NULL,
    "data" jsonb NOT NULL,
    "viewed" boolean,
    "add_time" timestamp NOT NULL,
    "delete_time" timestamp
) WITH (oids = false);