# ◈ ShadowTalk

Application de messagerie anonyme, chiffrée, temps réel — inspirée de Telegram.

---

## Stack

| Côté       | Technologie                              |
|-----------|------------------------------------------|
| Frontend  | React 18 + Vite + React Router           |
| Backend   | Node.js + Express + Socket.io            |
| Base de données | MongoDB Atlas (Mongoose)           |
| Auth      | JWT (30 jours), sans email ni données perso |
| Chiffrement | AES-256 côté client (crypto-js)        |
| Déploiement | Render (backend) + Vercel (frontend)   |

---

## Installation locale

### 1. Cloner / ouvrir le projet

```bash
cd shadowtalk
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Édite .env avec ta vraie MONGODB_URI et tes secrets
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Édite .env si nécessaire (VITE_BACKEND_URL, VITE_ENC_KEY)
npm install
npm run dev
```

### 4. Ouvrir dans le navigateur

```
http://localhost:5173
```

---

## Variables d'environnement

### Backend `.env`

| Variable         | Description                                  |
|-----------------|----------------------------------------------|
| `PORT`          | Port du serveur (défaut: 5000)               |
| `MONGODB_URI`   | URI de connexion MongoDB Atlas               |
| `JWT_SECRET`    | Clé secrète JWT (min. 32 caractères random)  |
| `ENCRYPTION_KEY`| Clé AES-256 (exactement 32 caractères)       |
| `CLIENT_URL`    | URL du frontend (pour CORS)                  |

### Frontend `.env`

| Variable            | Description                              |
|--------------------|------------------------------------------|
| `VITE_API_URL`     | Base URL de l'API (`/api` en local)      |
| `VITE_BACKEND_URL` | URL complète du backend (pour Socket.io) |
| `VITE_ENC_KEY`     | Clé AES-256 (DOIT être identique au backend) |

---

## Fonctionnalités

- ✅ Création de profil anonyme (username + mot de passe + question secrète + avatar)
- ✅ Connexion / déconnexion
- ✅ Récupération d'accès via question secrète
- ✅ Banque de 24 avatars (aucune photo perso)
- ✅ Chiffrement AES-256 de tous les messages
- ✅ Chat 1-1 temps réel (WebSocket)
- ✅ Groupes de chat
- ✅ Recherche d'utilisateur par username
- ✅ Indicateur de frappe (typing…)
- ✅ Notifications browser + in-app
- ✅ Fil d'actu communautaire (posts, likes, commentaires)
- ✅ Intégration YouTube + liens web dans le fil
- ✅ Awake ping toutes les 13 min (évite le sleep sur Render)
- ✅ Thème dark underground

---

## Déploiement sur Render + Vercel

### Backend → Render (Web Service)

1. Push ton code sur GitHub
2. Créer un **Web Service** sur [render.com](https://render.com)
3. Root directory : `backend`
4. Build command : `npm install`
5. Start command : `node server.js`
6. Ajoute toutes les variables d'environnement

### Frontend → Vercel

1. Créer un projet sur [vercel.com](https://vercel.com)
2. Root directory : `frontend`
3. Build command : `npm run build`
4. Output directory : `dist`
5. Ajoute `VITE_BACKEND_URL=https://ton-app.onrender.com` et `VITE_ENC_KEY=...`

> ⚠️ La `VITE_ENC_KEY` doit être **identique** entre frontend et backend pour que le déchiffrement fonctionne.

---

## Structure du projet

```
shadowtalk/
├── backend/
│   ├── models/          # User, Chat, Message, Post
│   ├── routes/          # auth, users, chats, messages, posts
│   ├── middleware/       # auth JWT
│   ├── server.js        # Express + Socket.io
│   └── .env.example
│
└── frontend/
    └── src/
        ├── components/
        │   └── layout/  # Sidebar + Layout
        ├── context/     # AuthContext, SocketContext
        ├── pages/       # Register, Login, Recover, Chats, ChatRoom, Feed
        ├── utils/       # api.js (HTTP + crypto), avatars.js
        └── App.jsx
```
