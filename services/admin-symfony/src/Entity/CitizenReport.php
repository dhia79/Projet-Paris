<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\CitizenReportRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A problem reported on a cool spot by a member of the public.
 *
 * Maps onto the `citizen_reports` table created by pipeline/sql/001_schema.sql.
 * The schema is owned by the pipeline, not by Doctrine migrations: the Go API
 * and the Airflow loader read the same tables, so one service inventing its own
 * DDL would put the three out of step.
 */
#[ORM\Entity(repositoryClass: CitizenReportRepository::class)]
#[ORM\Table(name: 'citizen_reports')]
#[ORM\Index(name: 'idx_report_status', columns: ['status'])]
#[ApiResource(
    shortName: 'Report',
    operations: [
        new GetCollection(),
        new Get(),
        // Anyone may report; only staff may triage. Enforced in security.yaml
        // by path, and restated here so the resource is readable on its own.
        new Post(),
        new Patch(security: "is_granted('ROLE_ADMIN')"),
    ],
    normalizationContext: ['groups' => ['report:read']],
    denormalizationContext: ['groups' => ['report:write']],
)]
class CitizenReport
{
    public const KINDS = ['out_of_service', 'crowded', 'closed', 'wrong_info', 'other'];
    public const STATUSES = ['pending', 'confirmed', 'rejected'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT, options: ['unsigned' => true])]
    #[Groups(['report:read'])]
    private ?int $id = null;

    /**
     * The namespaced spot id, e.g. `fountain:1325`. Kept as a plain string
     * rather than a Doctrine association: cool_spots is written exclusively by
     * the pipeline, and mapping it as an entity would invite Doctrine to try
     * to manage rows it does not own.
     */
    #[ORM\Column(name: 'spot_id', length: 96)]
    #[Assert\NotBlank(message: 'A report must name the spot it concerns.')]
    #[Assert\Length(max: 96)]
    #[Assert\Regex(
        pattern: '/^(fountain|green|facility):[A-Za-z0-9_-]+$/',
        message: 'Spot id must look like fountain:123, green:456 or facility:789.',
    )]
    #[Groups(['report:read', 'report:write'])]
    private string $spotId = '';

    #[ORM\Column(length: 32)]
    #[Assert\Choice(choices: self::KINDS, message: 'Unknown report kind.')]
    #[Groups(['report:read', 'report:write'])]
    private string $kind = 'other';

    #[ORM\Column(length: 1000, nullable: true)]
    #[Assert\Length(max: 1000)]
    #[Groups(['report:read', 'report:write'])]
    private ?string $comment = null;

    #[ORM\Column(name: 'reported_at', type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['report:read'])]
    private \DateTimeImmutable $reportedAt;

    /** Not writable on create: a reporter does not get to mark their own report confirmed. */
    #[ORM\Column(length: 16)]
    #[Assert\Choice(choices: self::STATUSES)]
    #[Groups(['report:read', 'report:admin'])]
    private string $status = 'pending';

    public function __construct()
    {
        $this->reportedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSpotId(): string
    {
        return $this->spotId;
    }

    public function setSpotId(string $spotId): self
    {
        $this->spotId = $spotId;

        return $this;
    }

    public function getKind(): string
    {
        return $this->kind;
    }

    public function setKind(string $kind): self
    {
        $this->kind = $kind;

        return $this;
    }

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function setComment(?string $comment): self
    {
        $this->comment = $comment;

        return $this;
    }

    public function getReportedAt(): \DateTimeImmutable
    {
        return $this->reportedAt;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;

        return $this;
    }
}
