
import { Router, Request, Response } from 'express';
import { TrainingCenterService } from '../services/trainingCenterService';
import { AuthService, type AuthenticatedRequest } from '../services/authService';
import { observabilityMiddleware } from '../middleware/observabilityMiddleware';
import { requireFlag } from '../lib/flags';

const router = Router();

// Apply middleware
router.use(AuthService.authMiddleware);
router.use(observabilityMiddleware);
router.use(requireFlag('training_center'));

// Get all training modules with user progress
router.get('/modules', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const modules = await TrainingCenterService.getTrainingModules(userId);
    
    res.json({
      success: true,
      modules,
      totalModules: modules.length,
      completedModules: modules.filter(m => m.status === 'COMPLETED').length
    });

  } catch (error) {
    console.error('Error getting training modules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get training modules'
    });
  }
});

// Start or resume a training module
router.post('/modules/:moduleId/start', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { moduleId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await TrainingCenterService.startModule(userId, moduleId);
    
    res.json({
      success: true,
      module: result.module,
      progress: result.progress
    });

  } catch (error) {
    console.error('Error starting training module:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start training module'
    });
  }
});

// Update training progress
router.post('/modules/:moduleId/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { moduleId } = req.params;
    const progressData = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const updatedProgress = await TrainingCenterService.updateProgress(userId, moduleId, progressData);
    
    res.json({
      success: true,
      progress: updatedProgress
    });

  } catch (error) {
    console.error('Error updating training progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update training progress'
    });
  }
});

// Get knowledge base articles
router.get('/knowledge-base', async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;
    
    const articles = await TrainingCenterService.getKnowledgeBase(
      search as string,
      category as string
    );
    
    res.json({
      success: true,
      articles,
      totalArticles: articles.length
    });

  } catch (error) {
    console.error('Error getting knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get knowledge base articles'
    });
  }
});

// Get certification preparation dashboard
router.get('/certification-prep', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const prepData = await TrainingCenterService.getCertificationPrep(userId);
    
    res.json({
      success: true,
      ...prepData
    });

  } catch (error) {
    console.error('Error getting certification prep:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get certification preparation data'
    });
  }
});

// Generate training certificate
router.post('/modules/:moduleId/certificate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { moduleId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const certificate = await TrainingCenterService.generateCertificate(userId, moduleId);
    
    res.json({
      success: true,
      certificateId: certificate.certificateId,
      downloadUrl: certificate.downloadUrl
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate certificate'
    });
  }
});

// Get interactive tutorial
router.get('/tutorials/:tutorialId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tutorialId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await TrainingCenterService.getInteractiveTutorial(tutorialId, userId);
    
    res.json({
      success: true,
      tutorial: result.tutorial,
      userProgress: result.userProgress
    });

  } catch (error) {
    console.error('Error getting tutorial:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tutorial'
    });
  }
});

// Update tutorial progress
router.post('/tutorials/:tutorialId/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tutorialId, stepId } = req.params;
    const { responses } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await TrainingCenterService.updateTutorialProgress(userId, tutorialId, stepId, responses);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error updating tutorial progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tutorial progress'
    });
  }
});

// Get comprehensive progress tracking
router.get('/progress/comprehensive', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const progress = await TrainingCenterService.getComprehensiveProgress(userId);
    
    res.json({
      success: true,
      ...progress
    });

  } catch (error) {
    console.error('Error getting comprehensive progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comprehensive progress'
    });
  }
});

// Get R2v3 terminology glossary
router.get('/glossary', async (req: Request, res: Response) => {
  try {
    const glossary = [
      {
        term: 'R2v3',
        definition: 'Responsible Recycling Standard version 3, the leading global standard for electronics recycling and data destruction.',
        category: 'Standards'
      },
      {
        term: 'Downstream Vendor',
        definition: 'Any entity that receives focus materials or components from an R2 facility for further processing.',
        category: 'Supply Chain'
      },
      {
        term: 'Focus Materials',
        definition: 'Electronic equipment and components that are subject to R2 requirements, as defined in Appendix A.',
        category: 'Materials'
      },
      {
        term: 'Data Sanitization',
        definition: 'The process of deliberately, permanently, and irreversibly removing or destroying data stored on a memory device.',
        category: 'Data Security'
      },
      {
        term: 'Due Diligence',
        definition: 'The investigation or exercise of care that a reasonable business or person is expected to take before entering into an agreement or contract.',
        category: 'Compliance'
      },
      {
        term: 'Chain of Custody',
        definition: 'The chronological documentation showing the seizure, custody, control, transfer, analysis, and disposition of evidence.',
        category: 'Documentation'
      },
      {
        term: 'Environmental Management System',
        definition: 'A systematic approach to managing environmental impacts through policies, procedures, and practices.',
        category: 'Environmental'
      },
      {
        term: 'Internal Audit',
        definition: 'Systematic, documented verification activities performed to determine compliance with standard requirements.',
        category: 'Quality Management'
      }
    ];

    res.json({
      success: true,
      glossary,
      totalTerms: glossary.length
    });

  } catch (error) {
    console.error('Error getting glossary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get glossary'
    });
  }
});

export default router;
