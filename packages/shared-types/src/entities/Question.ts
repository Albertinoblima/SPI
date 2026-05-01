// Question Entity Types

export type QuestionType =
    | 'text'
    | 'number'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'date'
    | 'photo'
    | 'signature'
    | 'geolocation';

export interface QuestionOption {
    id: string;
    label: string;
    value: string;
    order: number;
}

export interface Question {
    id: string;
    survey_id: string;
    question_text: string;
    question_type: QuestionType;
    is_required: boolean;
    options?: QuestionOption[];
    order_index: number;
    parent_question_id?: string;
    show_if_answer?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateQuestionDTO {
    survey_id: string;
    question_text: string;
    question_type: QuestionType;
    is_required?: boolean;
    options?: Omit<QuestionOption, 'id'>[];
    order_index: number;
    parent_question_id?: string;
    show_if_answer?: string;
}
