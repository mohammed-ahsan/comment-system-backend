# MERN Comment System

A full-stack comment system built with MongoDB, Express.js, React.js, and Node.js, featuring real-time updates, authentication, and a modern user interface.

## Repository Links

- **Frontend**: https://github.com/mohammed-ahsan/comment-system-frontend
- **Backend**: https://github.com/mohammed-ahsan/comment-system-backend

## Features

### Core Functionality
- ✅ User authentication (register/login/logout)
- ✅ Create, edit, and delete comments
- ✅ Reply to comments with nested threading
- ✅ Like/dislike comments with real-time updates
- ✅ Pagination and sorting (newest, most liked, most disliked)
- ✅ Real-time updates using Socket.io
- ✅ Responsive design with modern UI

### Security & Validation
- ✅ JWT authentication with secure token handling
- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ Rate limiting
- ✅ Authorization checks (only comment owners can edit/delete)

### Performance & UX
- ✅ Optimized database queries with indexing
- ✅ Efficient state management
- ✅ Loading states and error handling
- ✅ Smooth animations and transitions
- ✅ Mobile-responsive design

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **express-validator** - Input validation
- **bcryptjs** - Password hashing

### Frontend
- **React.js** - UI library
- **TypeScript** - Type safety
- **Axios** - HTTP client
- **Socket.io-client** - Real-time client
- **SCSS** - Styling

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   ```

2. **Install backend dependencies**
   ```bash
   cd comment-system-backend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/comment-system

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d

   # CORS Configuration
   CLIENT_URL=http://localhost:3000

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. **Start the backend server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   git clone <repository-url>
   ```
   ```bash
   cd comment-system-frontend
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # API Configuration
   REACT_APP_API_URL=http://localhost:5000/api

   # Socket.io Configuration
   REACT_APP_SOCKET_URL=http://localhost:5000

   # Environment
   NODE_ENV=development
   ```

4. **Start the frontend development server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## Test User Accounts

For testing purposes, you can use the following pre-configured user accounts:

### User A
- **Email**: earth.ahsan@gmail.com
- **Password**: .Adgjm11

### User B
- **Email**: riot.ahsan@gmail.com
- **Password**: .Adgjm11

These accounts can be used to test the comment system functionality, including:
- User authentication and login
- Creating and managing comments
- Replying to other users' comments
- Liking/disliking comments
- Real-time updates between different user sessions

## Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Password Hashing**: bcryptjs for secure password storage
3. **Input Validation**: Comprehensive validation using express-validator
4. **XSS Protection**: Input sanitization and escaping
5. **Rate Limiting**: Prevents abuse and brute force attacks
6. **CORS Configuration**: Proper cross-origin resource sharing setup
7. **Authorization Checks**: Users can only modify their own content

## Performance Optimizations

1. **Database Indexing**: Optimized queries for common operations
2. **Pagination**: Efficient data loading for large datasets
3. **Virtual Fields**: Computed fields for better performance
4. **Lean Queries**: Optimized database queries
5. **Real-time Updates**: Efficient Socket.io implementation
6. **Frontend Optimization**: Memoization and efficient re-renders

