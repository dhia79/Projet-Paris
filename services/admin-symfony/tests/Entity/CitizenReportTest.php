<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Entity\CitizenReport;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Validator\Validation;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final class CitizenReportTest extends TestCase
{
    private ValidatorInterface $validator;

    protected function setUp(): void
    {
        $this->validator = Validation::createValidatorBuilder()
            ->enableAttributeMapping()
            ->getValidator();
    }

    public function testAValidReportPassesValidation(): void
    {
        $report = (new CitizenReport())
            ->setSpotId('fountain:1325')
            ->setKind('out_of_service')
            ->setComment('Aucune eau ce matin.');

        self::assertCount(0, $this->validator->validate($report));
    }

    public function testItDefaultsToPending(): void
    {
        self::assertSame('pending', (new CitizenReport())->getStatus());
    }

    public function testItStampsTheReportTime(): void
    {
        $before = new \DateTimeImmutable();
        $report = new CitizenReport();

        self::assertGreaterThanOrEqual($before, $report->getReportedAt());
    }

    /**
     * @dataProvider invalidSpotIds
     */
    public function testItRejectsMalformedSpotIds(string $spotId): void
    {
        $report = (new CitizenReport())->setSpotId($spotId)->setKind('other');

        self::assertGreaterThan(0, $this->validator->validate($report)->count(), sprintf(
            'expected "%s" to be rejected',
            $spotId,
        ));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidSpotIds(): iterable
    {
        yield 'empty' => [''];
        yield 'no namespace' => ['1325'];
        yield 'unknown namespace' => ['pool:12'];
        yield 'sql-ish' => ["fountain:1'; DROP TABLE cool_spots--"];
        yield 'too long' => ['fountain:'.str_repeat('9', 100)];
    }

    public function testItRejectsAnUnknownKind(): void
    {
        $report = (new CitizenReport())->setSpotId('green:42')->setKind('on_fire');

        self::assertGreaterThan(0, $this->validator->validate($report)->count());
    }

    public function testItRejectsAnOverlongComment(): void
    {
        $report = (new CitizenReport())
            ->setSpotId('facility:7')
            ->setKind('crowded')
            ->setComment(str_repeat('a', 1001));

        self::assertGreaterThan(0, $this->validator->validate($report)->count());
    }
}
