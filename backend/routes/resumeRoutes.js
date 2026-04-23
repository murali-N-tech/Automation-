const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const Resume = require('../models/Resume');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', requireAuth, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Forward to Python AI Microservice
        const form = new FormData();
        form.append('file', req.file.buffer, req.file.originalname);
        
        const aiResponse = await axios.post('http://localhost:8000/parser/resume', form, {
            headers: { ...form.getHeaders() }
        });

        const parsedData = aiResponse.data;

        // Save to MongoDB
        const newResume = new Resume({
            userId: req.user.id,
            title: req.file.originalname,
            parsedData: parsedData,
            rawFileUrl: "local_temp_mock"
        });

        await newResume.save();
        res.json({ message: "Resume parsed and saved successfully", data: newResume });
    } catch (e) {
        console.error("Parse Error:", e.message);
        res.status(500).json({ error: "Failed to parse resume via AI service" });
    }
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const resumes = await Resume.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(resumes);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch resumes" });
    }
});

module.exports = router;