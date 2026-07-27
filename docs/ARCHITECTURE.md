# StockFlow Enterprise Architecture

## Vision

StockFlow Enterprise — облачная SaaS-платформа для автоматизации торговли, складского учета, финансового учета и аналитики с использованием искусственного интеллекта.

---

# Technology Stack

## Backend

* NestJS
* TypeScript
* Prisma ORM
* PostgreSQL
* Redis
* BullMQ

## Frontend

* Flutter
* Riverpod
* GoRouter
* Dio

## Infrastructure

* Docker
* Docker Compose
* GitHub Actions
* Nginx

---

# Architecture Style

* Modular Monolith
* Domain-Driven Design (DDD)
* Clean Architecture

---

# Core Modules

* Auth
* Companies
* Users
* Products
* Categories
* Warehouses
* Inventory
* Sales
* Customers
* Suppliers
* Finance
* Reports
* Notifications
* AI

---

# Principles

* One Responsibility per Class
* Dependency Injection
* Repository Pattern
* SOLID
* DRY
* KISS
* Strict TypeScript

---

# Database

* PostgreSQL
* Multi-tenant
* UUID Primary Keys
* Soft Delete
* Audit Log

---

# Security

* JWT Access Token
* Refresh Token
* RBAC
* Password Hashing (bcrypt)
* Rate Limiting

---

# API

REST API

Swagger documentation is mandatory for every endpoint.
