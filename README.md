# WTWR (What to Wear?): Back End

This project provides the back-end API for the WTWR weather-based clothing application. It stores users and clothing items in MongoDB, supports account registration and sign-in with JWT authorization, and exposes endpoints for managing profiles and clothing items.

## Technologies

- Node.js and Express
- MongoDB with Mongoose
- Validator for URL validation
- bcryptjs for password hashing
- JSON Web Tokens for authentication
- CORS for cross-origin requests
- ESLint with the Airbnb base configuration
- Nodemon for local development

## Project Pitch Video

Watch [WTWR Project Pitch - Gabriel Romero](https://drive.google.com/file/d/1_Wbd_Vhc8GmrwxpUsNToBX7m2Xa7sIrr/view?usp=sharing), where I explain WTWR and the challenges I faced while building the backend.

## Screenshots

Successful item creation:

![Successful item creation response](screenshots/create-item-response.png)

Validation error response:

![Validation error response](screenshots/validation-error-response.png)

## Getting Started

Install the project dependencies:

```bash
npm install
```

Start MongoDB with Docker:

```bash
docker compose up -d mongo
```

Start the API on `http://localhost:3001`:

```bash
npm run start
```

For development with hot reload:

```bash
npm run dev
```

Run the linter:

```bash
npm run lint
```

Run the automated checks:

```bash
npm test
```

## API Endpoints

### Users

- `POST /signup` — create an account with `name`, `avatar`, `email`, and `password`
- `POST /signin` — sign in with `email` and `password`; the response contains a JWT
- `GET /users/me` — get the authenticated user's profile
- `PATCH /users/me` — update the authenticated user's `name` and/or `avatar`

### Clothing Items

- `GET /items` — get all clothing items (public)
- `POST /items` — create an item with `name`, `weather`, and `imageUrl`
- `DELETE /items/:itemId` — delete an item you own
- `PUT /items/:itemId/likes` — like an item
- `DELETE /items/:itemId/likes` — unlike an item

All routes except `POST /signup`, `POST /signin`, and `GET /items` require an `Authorization: Bearer <token>` header. Set `JWT_SECRET` in the environment to override the development signing key; production requires this variable. The API connects to `mongodb://localhost:27017/wtwr_db`. Validation and request errors return JSON responses with a `message` field.
