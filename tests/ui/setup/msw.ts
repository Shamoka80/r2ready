import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock assessments API
  http.get('/api/assessments', () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Security Assessment 2024',
        description: 'Comprehensive security review for Q4 compliance',
        status: 'IN_PROGRESS',
        progress: 0.53,
        createdAt: '2024-12-15T10:00:00Z',
        updatedAt: '2024-12-15T12:00:00Z',
      },
      {
        id: '2',
        name: 'Compliance Review Q4',
        description: 'Quarterly compliance assessment',
        status: 'DRAFT',
        progress: 0.25,
        createdAt: '2024-12-14T09:00:00Z',
        updatedAt: '2024-12-14T11:00:00Z',
      },
    ]);
  }),

  // Mock individual assessment
  http.get('/api/assessments/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      name: 'Security Assessment 2024',
      description: 'Comprehensive security review for Q4 compliance',
      status: 'IN_PROGRESS',
      progress: 0.53,
      createdAt: '2024-12-15T10:00:00Z',
      updatedAt: '2024-12-15T12:00:00Z',
      framework: 'R2v3',
      type: 'Security',
      priority: 'High',
    });
  }),

  // Mock assessment questions
  http.get('/api/assessments/:id/questions', ({ params }) => {
    const { id } = params;
    return HttpResponse.json([
      {
        id: 'q1',
        assessmentId: id,
        text: 'Do you have documented information security policies?',
        type: 'multiple_choice',
        required: true,
        options: ['Yes', 'No', 'Partially'],
        category: 'Information Security',
      },
      {
        id: 'q2',
        assessmentId: id,
        text: 'Describe your incident response procedures.',
        type: 'text',
        required: true,
        category: 'Incident Management',
      },
    ]);
  }),

  // Mock standards/clauses
  http.get('/api/standards', () => {
    return HttpResponse.json([
      {
        id: 'std1',
        code: 'R2v3',
        name: 'R2v3 Pre-Certification',
        isActive: true,
      },
    ]);
  }),
];