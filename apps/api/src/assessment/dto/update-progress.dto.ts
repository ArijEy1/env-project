import { IsInt, Max, Min } from 'class-validator';
import { TOTAL_QUESTIONS } from '../questions';

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(TOTAL_QUESTIONS - 1)
  currentQuestionIndex!: number;
}
