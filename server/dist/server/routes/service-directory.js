import { Router } from 'express';
import { ServiceDirectoryService } from '../services/serviceDirectoryService.js';
const router = Router();
const serviceDirectory = ServiceDirectoryService.getInstance();
/**
 * @route   GET /api/directory
 * @desc    Get complete service directory
 * @access  Public
 */
router.get('/', serviceDirectory.handleGetDirectory);
/**
 * @route   GET /api/directory/search
 * @desc    Search services by name, description, or path
 * @access  Public
 */
router.get('/search', serviceDirectory.handleSearchServices);
/**
 * @route   GET /api/directory/category/:categoryId
 * @desc    Get services by category
 * @access  Public
 */
router.get('/category/:categoryId', serviceDirectory.handleGetCategory);
/**
 * @route   GET /api/directory/health
 * @desc    Get service health status
 * @access  Public
 */
router.get('/health', (req, res) => {
    const serviceDirectory = ServiceDirectoryService.getInstance();
    const health = serviceDirectory.getServiceHealth();
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        health
    });
});
export default router;
