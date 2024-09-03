-- Adminer 4.8.1 PostgreSQL 16.2 (Ubuntu 16.2-1.pgdg22.04+1) dump

DROP TABLE IF EXISTS "landinfo";
DROP SEQUENCE IF EXISTS landinfo_id_seq;
CREATE SEQUENCE landinfo_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."landinfo" (
    "id" integer DEFAULT nextval('landinfo_id_seq') NOT NULL,
    "owner_id" integer,
    "polygon_info" jsonb NOT NULL,
    "name" character varying(255),
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "landinfo_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

TRUNCATE "landinfo";
INSERT INTO "landinfo" ("id", "owner_id", "polygon_info", "name", "created_at") VALUES
(87,	1,	'[[35.71773870140577, 51.43027384590928], [35.71697240317088, 51.44315364714493], [35.708612307384655, 51.44255258975396], [35.70857747181767, 51.4298445192014]]',	'Potato',	'2024-09-01 17:27:41.601365'),
(88,	1,	'[[35.71088619363124, 51.466871237058456], [35.711156161057524, 51.4678211223996], [35.710137246951724, 51.46801431941815], [35.709854212944066, 51.46702150140623]]',	'tomato Land',	'2024-09-01 17:56:34.691883'),
(89,	1,	'[[35.709945490652366, 51.465470500197], [35.709444736288646, 51.46373172703019], [35.7093576482521, 51.46377465970096], [35.70928362334621, 51.46348486417316], [35.70883511803452, 51.46368342777556], [35.70942296428843, 51.46568516355093]]',	'MelonLand',	'2024-09-02 04:20:58.849146');

DROP TABLE IF EXISTS "landowners";
DROP SEQUENCE IF EXISTS landowners_id_seq;
CREATE SEQUENCE landowners_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."landowners" (
    "id" integer DEFAULT nextval('landowners_id_seq') NOT NULL,
    "wallet" character varying(255) NOT NULL,
    CONSTRAINT "landowners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "landowners_wallet_key" UNIQUE ("wallet")
) WITH (oids = false);

TRUNCATE "landowners";
INSERT INTO "landowners" ("id", "wallet") VALUES
(1,	'0xe60c3b08351184cf1f89e7061b3609dc8e5041a0');

DROP TABLE IF EXISTS "minted_parcels";
DROP SEQUENCE IF EXISTS minted_parcels_id_seq;
CREATE SEQUENCE minted_parcels_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1;

CREATE TABLE "public"."minted_parcels" (
    "id" integer DEFAULT nextval('minted_parcels_id_seq') NOT NULL,
    "parcel_uuid" uuid NOT NULL,
    "parcel_price" numeric(78,0) NOT NULL,
    "parcel_royalty" numeric(78,0) NOT NULL,
    "parcel_points" jsonb NOT NULL,
    "parcel_land_id" integer NOT NULL,
    "parcel_land_name" character varying(255) NOT NULL,
    "parcel_owner_wallet" character varying(255) NOT NULL,
    "ipfs_hash" character varying(255) NOT NULL,
    "tx_hash" character varying(255) NOT NULL,
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "minted_parcels_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

TRUNCATE "minted_parcels";

ALTER TABLE ONLY "public"."landinfo" ADD CONSTRAINT "landinfo_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES landowners(id) ON DELETE CASCADE NOT DEFERRABLE;

-- 2024-09-03 17:47:45.88006+00