const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const Resume = require('../models/Resume');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            return cb(new Error('Only PDF resumes are supported.'));
        }
        cb(null, true);
    }
});

const uploadResume = (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: "Resume file is too large. Maximum size is 5 MB." });
        }

        return res.status(400).json({ error: err.message || "Invalid resume upload." });
    });
};

router.post('/upload', requireAuth, uploadResume, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Forward to Python AI Microservice
        const form = new FormData();
        form.append('file', req.file.buffer, req.file.originalname);
        
        const aiResponse = await axios.post('http://localhost:8000/parser/resume', form, {
            headers: { ...form.getHeaders() },
            maxBodyLength: Infinity
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
        const serviceStatus = e.response?.status;
        const serviceMessage = e.response?.data?.detail || e.response?.data?.error;

        console.error("Parse Error:", serviceMessage || e.message);

        if (serviceStatus) {
            return res.status(serviceStatus).json({
                error: serviceMessage || "Resume parsing failed"
            });
        }

        if (e.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: "Resume parser service is not running on port 8000."
            });
        }

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
