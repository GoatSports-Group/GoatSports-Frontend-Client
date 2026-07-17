export type StartProcessRequest = {
    variables: Map<string, object>;
}

export type ProcessInstanceResponse = {
    processInstanceKey: number;
    bpmnProcessId: string;
    version: number;
    processDefinitionKey: number;
}

export type ProcessInstanceVariablesResponse = {
    presignedUrls: {
        uploadUrl: string;
        objectKey: string;
    }[];
    ownerApplicationId: string;
}

export type UserTaskResponse = {
    key: number;
    name: string;
    elementId: string;
    assignee: string,
    state: string;
    processInstanceKey: number;
    bpmnProcessId: string;
}

export type CompleteTaskRequest = {
    taskKey: number;
    completeTask: {
        variables: {
            documentKeys: string[]
        }
    }
}