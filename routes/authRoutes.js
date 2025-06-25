const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middlewares/authMiddlewares');
const adminMiddleware = require('../middlewares/adminMiddleware');

const {
    register,
    login,
    logout,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
    updatePassword,
    verifyCode,
    resetPassword,
    updateUserAdmin,
    createWorkspace,
    getHostWorkspaces,
    toggleWorkspaceStatus,
    updateWorkspace,
    getAllWorkspaces
} = require('../controllers/authControllers');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
},
});

const upload = multer({ storage });

// User routes
router.post('/register', upload.single('image'), register);
router.post('/login', upload.none(), login);
router.post('/logout', logout);
router.get('/user', authMiddleware, getUser);
router.post('/updatepassword', upload.none(), updatePassword);
router.post('/verifycode', upload.none(), verifyCode);
router.post('/resetpassword', upload.none(), resetPassword);
router.get('/users', authMiddleware, getUsers);
router.put('/users/:id', authMiddleware, upload.single('image'), updateUser);
router.delete('/users/:id', authMiddleware, deleteUser);
router.put('/admin/users/:id', authMiddleware, adminMiddleware, upload.single('image'), updateUserAdmin);

// Workspace routes
// Fix the workspace routes
router.post('/workspaces', 
  authMiddleware, 
  upload.single('image'), 
  createWorkspace
);

router.get('/workspaces', 
  authMiddleware, 
  getHostWorkspaces
);

router.put('/workspaces/:id/toggle', 
  authMiddleware, 
  toggleWorkspaceStatus
);
router.put('/workspaces/:id', 
  authMiddleware, 
  upload.single('image'), 
  updateWorkspace
);
router.get('/all-workspaces', authMiddleware, getAllWorkspaces);

module.exports = router;