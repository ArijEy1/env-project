import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * v0.4 answer submission. The client sends its raw selection (option index/value
 * or a number) plus optional attribution/evidence; the server normalizes it to a
 * score based on the question's answer type. Legacy `score`/`calculatorInputs`
 * are still accepted for backward compatibility.
 */
export class SaveAnswerDto {
  @IsString()
  @MaxLength(40)
  questionId!: string;

  // Selected option, by index into the question's options or by its value.
  @IsOptional()
  @IsInt()
  @Min(0)
  optionIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  optionValue?: string;

  // Numeric / percentage answers.
  @IsOptional()
  @IsNumber()
  number?: number;

  // Attribution category id / note for outcome/trend improvement claims.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attribution?: string;

  // Evidence level the entity can provide (E1..E5).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  evidenceLevel?: string;

  // --- legacy (pre-v0.4) ---
  @IsOptional()
  @IsInt()
  score?: number;

  @IsOptional()
  @IsObject()
  calculatorInputs?: Record<string, unknown>;
}
