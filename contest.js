const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Validate that startTime is in the future
contestSchema.path('startTime').validate(function(value) {
    return value > new Date();
}, 'Start time must be in the future');

// Validate that endTime is after startTime
contestSchema.path('endTime').validate(function(value) {
    return this.startTime < value;
}, 'End time must be after start time');

const Contest = mongoose.model('Contest', contestSchema);

module.exports = Contest;
