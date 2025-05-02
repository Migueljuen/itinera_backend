const express = require('express');
const router = express.Router();
const { createTag, getAllTags, getTagById, updateTag, deleteTag } = require('../controllers/tagController.js');
// const authenticateToken = require('../middleware/auth');


router.post('/create', createTag);


router.get('/', getAllTags); 

router.get('/:tag_id', getTagById); 

router.put('/:tag_id', updateTag); 

router.delete('/:tag_id', deleteTag); 

module.exports = router;
