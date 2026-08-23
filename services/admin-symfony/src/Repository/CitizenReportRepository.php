<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CitizenReport;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CitizenReport>
 */
class CitizenReportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CitizenReport::class);
    }

    /**
     * Spots with the most pending reports — the back-office triage queue.
     *
     * @return list<array{spotId: string, pending: int, lastReportedAt: string}>
     */
    public function pendingHotspots(int $limit = 20): array
    {
        return $this->createQueryBuilder('r')
            ->select('r.spotId AS spotId', 'COUNT(r.id) AS pending', 'MAX(r.reportedAt) AS lastReportedAt')
            ->where('r.status = :status')
            ->setParameter('status', 'pending')
            ->groupBy('r.spotId')
            ->orderBy('pending', 'DESC')
            ->addOrderBy('lastReportedAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getArrayResult();
    }

    /**
     * Reports for one spot, newest first.
     *
     * @return list<CitizenReport>
     */
    public function findForSpot(string $spotId, int $limit = 50): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.spotId = :spotId')
            ->setParameter('spotId', $spotId)
            ->orderBy('r.reportedAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Counts per status, for the admin dashboard header.
     *
     * @return array<string, int>
     */
    public function countByStatus(): array
    {
        $rows = $this->createQueryBuilder('r')
            ->select('r.status AS status', 'COUNT(r.id) AS total')
            ->groupBy('r.status')
            ->getQuery()
            ->getArrayResult();

        // Seed every status so a zero renders as 0 rather than going missing.
        $counts = array_fill_keys(CitizenReport::STATUSES, 0);
        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return $counts;
    }
}
