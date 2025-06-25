// Import required modules and models
const User = require('../models/User'); // User model for database operations
const Workspace = require('../models/Workspace'); // Workspace model
const jwt = require('jsonwebtoken'); // For creating JSON Web Tokens
const bcrypt = require('bcryptjs'); // For password hashing
const dotenv = require('dotenv'); // For loading environment variables
const emailSender = require('./emailSender'); // Custom module for sending emails
const passwordGenerator = require('./passwordGenerator'); // Custom module for generating passwords
dotenv.config(); // Load environment variables from .env file

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// User registration controller
const register = async (req, res) => {
    // Destructure required fields from request body
    const { email, name, password, userType } = req.body;
    try {
        // Check if user already exists with same email or name
        const exists = await User.findOne({ $or: [{ email }, { name }] });
        if (exists) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Create new user with provided data
        const newUser = new User({
            email,
            name,
            password,
            image: req.file ? req.file.path : undefined, // If file uploaded, store path
            userType,
        });
        await newUser.save(); // Save user to database
        // Convert user object to plain JS object and remove password before sending response
        const userObj = newUser.toObject();
        delete userObj.password;
        res.status(201).json(userObj); // Send success response with user data
    } catch (err) {
        res.status(500).json({ error: 'Server error' }); // Handle errors
    }
}

// User login controller
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user by email
        const user = await User.findOne({ email: email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Compare provided password with stored hash
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        // Remove password from user object before sending response
        const { password: passwords, ...userData } = user.toObject();

        // Create JWT token with user ID and role, expires in 1 hour
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        
        // Set token as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true, // Prevent client-side JS access
            sameSite: 'lax', // CSRF protection
            maxAge: 60 * 60 * 1000 // 1 hour expiration
        });
        
        // Send user data in response
        res.json({ user: userData });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// User logout controller
const logout = (req, res) => {
    // Clear the authentication cookie
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax'
    });
    res.json({ success: true }); // Confirm logout success
}

// Get current user's data
const getUser = async (req, res) => {
    // Find user by ID from JWT (stored in req.user during authentication)
    const user = await User.findOne({ _id: req.user.id }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Remove password before sending response
    const { password, ...userData } = user;
    res.json(userData);
}

// Initiate password reset process
const updatePassword = async (req, res) => {
    const { email } = req.body;
    try {
        // Find user by email
        const user = await User.findOne({ email: email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Generate and set reset code with 15-minute expiration
        const genPassword = passwordGenerator();
        user.resetCode = genPassword;
        user.resetCodeExpires = Date.now() + 15 * 60 * 1000;
        await user.save();
        
        // Send reset code via email
        await emailSender(email, genPassword);
        res.status(201).json({ success: true, message: "Email sent." });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// Verify reset code
const verifyCode = async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ email: email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Check if code matches and hasn't expired
        if (
            user.resetCode !== code ||
            !user.resetCodeExpires ||
            user.resetCodeExpires < Date.now()
        ) {
            return res.status(401).json({ error: 'Invalid or expired code' });
        }
        res.status(200).json({ success: true, message: 'Code verified successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// Reset password with verified code
const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const user = await User.findOne({ email: email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Verify code again (security measure)
        if (
            user.resetCode !== code ||
            !user.resetCodeExpires ||
            user.resetCodeExpires < Date.now()
        ) {
            return res.status(401).json({ error: 'Invalid or expired code' });
        }
        
        // Update password and clear reset code fields
        user.password = newPassword;
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;
        await user.save();
        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// Get all users (admin function)
const getUsers = async (req, res) => {
    try {
        // Find all users and remove passwords from response
        const users = await User.find().lean();
        res.json(users.map(u => {
            const { password, ...userWithoutPassword } = u;
            return userWithoutPassword;
        }));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// Update user profile
const updateUser = async (req, res) => {
    try {
        // Check if user is admin or updating their own profile
        if (req.user.userType !== 'admin' && req.user.id !== req.params.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        // Prepare update data
        const updateData = { ...req.body };
        if (req.file) {
            updateData.image = req.file.path; // Update image if file uploaded
        }
        
        // Hash new password if provided
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        } else {
            delete updateData.password; // Remove password if not updating
        }
        
        // Find and update user
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true } // Return updated document and run validators
        ).lean();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin-only user update
const updateUserAdmin = async (req, res) => {
    try {
        const updateData = { ...req.body };

        if (req.file) {
            updateData.image = req.file.path;
        }

        // Hash password if provided
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        } else {
            delete updateData.password;
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).lean();

        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

// Workspace-related controllers

// Create new workspace
const createWorkspace = async (req, res) => {
  try {
    let amenities = [];
    // Parse amenities if provided (can be string or array)
    if (req.body.amenities) {
      try {
        amenities = typeof req.body.amenities === 'string' 
          ? JSON.parse(req.body.amenities)
          : req.body.amenities;
      } catch (err) {
        amenities = [];
      }
    }

    // Create new workspace with provided data
    const workspace = new Workspace({
      name: req.body.name,
      location: req.body.location,
      capacity: req.body.capacity,
      amenities: amenities,
      price: Number(req.body.price),
      description: req.body.description,
      createdBy: req.user.id, // Set creator as current user
      image: req.file?.path // Optional image path
    });

    await workspace.save(); // Save to database
    res.status(201).json(workspace); // Return created workspace
  } catch (err) {
    console.error('Workspace creation error:', err);
    res.status(500).json({ 
      error: 'Failed to create workspace',
      details: err.message 
    });
  }
};

// Get workspaces created by current host
const getHostWorkspaces = async (req, res) => {
  try {
    // Find workspaces created by current user
    const workspaces = await Workspace.find({ createdBy: req.user.id })
      .populate('createdBy', 'name email') // Include creator details
      .populate('bookings.guest', 'name email'); // Include guest details for bookings
    res.json(workspaces);
  } catch (err) {
    console.error('Workspace fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

// Toggle workspace status (active/inactive)
const toggleWorkspaceStatus = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    
    // Toggle status
    workspace.status = workspace.status === 'active' ? 'inactive' : 'active';
    await workspace.save();
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Update workspace details
const updateWorkspace = async (req, res) => {
  try {
    let amenities = [];
    // Parse amenities similar to create function
    if (req.body.amenities) {
      try {
        amenities = typeof req.body.amenities === 'string' 
          ? JSON.parse(req.body.amenities)
          : req.body.amenities;
      } catch (err) {
        amenities = [];
      }
    }

    // Prepare update data
    const updateData = {
      name: req.body.name,
      location: req.body.location,
      capacity: req.body.capacity,
      amenities: amenities,
      price: Number(req.body.price),
      description: req.body.description
    };

    // Update image if new file uploaded
    if (req.file) {
      updateData.image = req.file.path;
    }

    // Find and update workspace
    const workspace = await Workspace.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true } // Return updated document
    );

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace);
  } catch (err) {
    console.error('Workspace update error:', err);
    res.status(500).json({ 
      error: 'Failed to update workspace',
      details: err.message 
    });
  }
};

// Get all active workspaces
const getAllWorkspaces = async (req, res) => {
  try {
    // Find all active workspaces
    const workspaces = await Workspace.find({ status: 'active' })
      .populate('createdBy', 'name email'); // Include creator details
    res.json(workspaces);
  } catch (err) {
    console.error('Workspace fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

// Export all controllers
module.exports = { 
  getAllWorkspaces,
  updateWorkspace,
  createWorkspace,
  toggleWorkspaceStatus,
  getHostWorkspaces,
  register, 
  login, 
  logout, 
  getUser, 
  getUsers, 
  updateUser, 
  updateUserAdmin,
  deleteUser, 
  updatePassword, 
  verifyCode, 
  resetPassword 
};