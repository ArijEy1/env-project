import { IsIn, IsInt, IsString } from 'class-validator';
import { QUESTION_IDS, VALID_SCORES } from '../questions';

export class SaveAnswerDto {
  @IsString()
  @IsIn(QUESTION_IDS)
  questionId!: string;

  @IsInt()
  @IsIn(VALID_SCORES)
  score!: number;
}
