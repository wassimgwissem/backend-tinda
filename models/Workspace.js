const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  capacity: { type: String, required: true },
  amenities: { type: [String], default: [] },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  image: { type: String },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  bookings: [{
    date: { type: Date, required: true },
    guest: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

module.exports = mongoose.model('Workspace', workspaceSchema);