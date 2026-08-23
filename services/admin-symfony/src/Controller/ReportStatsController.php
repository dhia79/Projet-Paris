<?php

declare(strict_types=1);

namespace App\Controller;

use App\Repository\CitizenReportRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Aggregates over citizen reports.
 *
 * Deliberately separate from the API Platform resource: these are read models
 * for the back-office, not CRUD over the entity, and shaping them as filtered
 * collection endpoints would be a worse fit than a plain query.
 */
final class ReportStatsController extends AbstractController
{
    public function __construct(private readonly CitizenReportRepository $reports)
    {
    }

    #[Route('/api/admin/reports/stats', name: 'admin_report_stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        return $this->json([
            'byStatus' => $this->reports->countByStatus(),
            'hotspots' => $this->reports->pendingHotspots(),
        ]);
    }

    #[Route('/api/reports/spot/{spotId}', name: 'reports_for_spot', methods: ['GET'], requirements: [
        'spotId' => '(fountain|green|facility):[A-Za-z0-9_-]+',
    ])]
    public function forSpot(string $spotId): JsonResponse
    {
        return $this->json(
            $this->reports->findForSpot($spotId),
            200,
            [],
            ['groups' => ['report:read']],
        );
    }
}
