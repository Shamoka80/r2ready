import { Router } from 'express';
import multer from 'multer';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { db } from '../db';
import { questions, clauses } from '../../shared/schema';
import { count, like, eq, sql } from 'drizzle-orm';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// TODO: Import functionality temporarily disabled to avoid including tools directory in build
// Import the function from CLI tool
// import { importQuestions } from '../tools/import-questions';

router.post('/import-questions', upload.single('file'), async (req, res) => {
  // TODO: Re-enable this functionality after refactoring tools to not be included in server build
  return res.status(501).json({ 
    error: 'Import functionality temporarily unavailable',
    message: 'This feature is currently disabled during deployment configuration'
  });
  
  /* try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ error: 'Only CSV files are allowed' });
    }

    // Write uploaded file to temporary location
    const tempPath = join(process.cwd(), 'temp-import.csv');
    writeFileSync(tempPath, req.file.buffer);

    // Capture console output
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await importQuestions(tempPath);
      console.log = originalLog;
      
      // Clean up temp file
      unlinkSync(tempPath);
      
      res.json({
        success: true,
        message: 'Questions imported successfully',
        logs: logs
      });
    } catch (error) {
      console.log = originalLog;
      unlinkSync(tempPath);
      
      res.status(500).json({
        error: 'Import failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } */
});

router.get('/import-questions/coverage', async (req, res) => {
  try {
    const coverage: Record<string, number> = {};
    
    // CR1..CR10
    for (let i = 1; i <= 10; i++) {
      const crRef = `CR${i}`;
      // Get clauses matching the ref pattern
      const matchingClauses = await db.select({ id: clauses.id })
        .from(clauses as any)
        .where(like(clauses.ref, `${crRef}%`));
      
      if (matchingClauses.length > 0) {
        const clauseIds = matchingClauses.map(c => c.id);
        const result = await db.select({ count: count() })
          .from(questions as any)
          .where(sql`${questions.clauseId} = ${clauseIds[0]}`);
        coverage[crRef] = result[0]?.count || 0;
      } else {
        coverage[crRef] = 0;
      }
    }
    
    // APP-A..APP-G
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      const appRef = `APP-${letter}`;
      // Get clauses matching the ref pattern
      const matchingClauses = await db.select({ id: clauses.id })
        .from(clauses as any)
        .where(like(clauses.ref, `${appRef}%`));
      
      if (matchingClauses.length > 0) {
        const clauseIds = matchingClauses.map(c => c.id);
        const result = await db.select({ count: count() })
          .from(questions as any)
          .where(sql`${questions.clauseId} = ${clauseIds[0]}`);
        coverage[appRef] = result[0]?.count || 0;
      } else {
        coverage[appRef] = 0;
      }
    }
    
    // Total questions
    const totalResult = await db.select({ count: count() }).from(questions as any);
    const total = totalResult[0]?.count || 0;
    
    res.json({
      coverage,
      total
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get coverage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;