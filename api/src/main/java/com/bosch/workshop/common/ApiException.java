package com.bosch.workshop.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class ApiException extends RuntimeException {
    public ApiException(String message) {
        super(message);
    }

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    private HttpStatus status = HttpStatus.BAD_REQUEST;

    public HttpStatus getStatus() {
        return status;
    }
}
