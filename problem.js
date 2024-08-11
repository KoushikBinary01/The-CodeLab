const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  tags: [{ type: String }],
  constraints: { type: String },
  inputFormat: { type: String },
  outputFormat: { type: String },
  sampleInput: { type: String },
  sampleOutput: { type: String },
  testCases: [{
    input: String,
    output: String,
    isHidden: Boolean
  }],
  timeLimit: { type: Number, default: 1000 },
  memoryLimit: { type: Number, default: 256 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  contestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', default: null }
});

const Problem = mongoose.model('Problem', problemSchema);

module.exports = Problem;
