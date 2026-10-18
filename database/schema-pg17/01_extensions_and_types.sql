-- =====================================================================
-- OLMS - He thong thi trac nghiem
-- 01_extensions_and_types.sql
-- Muc dich : Kich hoat extension can thiet & khai bao cac kieu ENUM dung chung
-- Yeu cau  : PostgreSQL 17, su dung gen_random_uuid() (UUID v4)
-- Thu tu chay: 01 -> 02 -> 03
-- =====================================================================
 
-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
 
-- pgcrypto: du phong cho gen_random_uuid() (UUID v4) tren cac ban PostgreSQL
-- cu hon 18, hoac cho cac truong hop can UUID ngau nhien khong can sap xep.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
 
-- pg_trgm: ho tro tim kiem gan dung (fuzzy / LIKE %..%) tren cac cot van ban
-- nhu question_versions.content, users.full_name (tuy chon, phuc vu tinh nang tim kiem).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Application roles are provisioned outside DDL by DBA/IaC (no CREATE ROLE here).

-- Ghi chu quan trong ve khoa chinh (PK):
-- Tu PostgreSQL 18, ham uuidv7() duoc ho tro native, sinh UUID co the sap xep
-- theo thoi gian tao (time-ordered) -> giup B-Tree index insert tuan tu thay vi
-- ngau nhien, giam page-split va phan manh index so voi UUID v4 truyen thong.
-- Ban schema-pg17 dung DEFAULT gen_random_uuid() cho cac cot id co gia tri mac dinh.
--
-- Neu ha tang bat buoc dung PostgreSQL < 18:
--   (a) thay `DEFAULT uuidv7()` bang `DEFAULT gen_random_uuid()` (UUID v4), hoac
--   (b) cai them extension pg_uuidv7 (https://github.com/fboulnois/pg_uuidv7)
--       va dung ham uuid_generate_v7() tuong duong.
 
-- ---------------------------------------------------------------------
-- 2. ENUM TYPES
-- ---------------------------------------------------------------------
-- Nguyen tac: chi dung ENUM cho thuoc tinh co tap gia tri ON DINH, hiem khi
-- mo rong. Cac cot "status" (de phat sinh trang thai moi theo nghiep vu) se
-- dung VARCHAR + CHECK CONSTRAINT (xem 02_tables.sql) thay vi ENUM, de tranh
-- rui ro khi phai ALTER TYPE ... ADD VALUE trong tuong lai.
 
-- Vai tro nguoi dung trong he thong
CREATE TYPE user_role_enum AS ENUM (
  'ADMIN',
  'TEACHER',
  'STUDENT'
);
 
-- Muc do nhan thuc chuan hoa theo SRS (UC-04)
CREATE TYPE difficulty_level_enum AS ENUM (
  'EASY',
  'MEDIUM',
  'HARD'
);

-- ---------------------------------------------------------------------
-- 3. DOMAIN dung chung (tuy chon)
-- ---------------------------------------------------------------------
-- Domain diem so chuan hoa: khong am, 2 chu so thap phan. Dung lam kieu du
-- lieu tham khao khi thiet ke ung dung / ORM; cac cot diem trong schema van
-- khai bao truc tiep NUMERIC(5,2) + CHECK de gan voi tung boi canh nghiep vu.
CREATE DOMAIN score_type AS NUMERIC(5, 2) CHECK (VALUE >= 0);
 
