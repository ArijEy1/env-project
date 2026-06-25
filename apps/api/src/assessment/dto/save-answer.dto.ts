import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALID_SCORES } from '../questions';

export class SaveAnswerDto {
  // Validated against the assessment's frozen question snapshot in the service,
  // not a static list, so it works with profile-generated question sets.
  @IsString()
  @MaxLength(40)
  questionId!: string;

  // Provided for normal questions. Calculator questions instead send
  // calculatorInputs and the server derives the score.
  @IsOptional()
  @IsInt()
  @IsIn(VALID_SCORES)
  score?: number;

  @IsOptional()
  @IsObject()
  calculatorInputs?: Record<string, unknown>;
}
