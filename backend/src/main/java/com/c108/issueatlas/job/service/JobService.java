package com.c108.issueatlas.job.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.job.dto.JobResponse;
import com.c108.issueatlas.job.repository.JobRepository;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class JobService {
    private static final Set<String> STATUSES = Set.of("running", "ok", "failed", "aborted");
    private static final int MAX_SIZE = 100;

    private final JobRepository jobs;

    public JobService(JobRepository jobs) {
        this.jobs = jobs;
    }

    public JobResponse.Page list(
            String status, String sourceId, String specId, int page, int size) {
        if ((status != null && !STATUSES.contains(status))
                || page < 1
                || size < 1
                || size > MAX_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        return new JobResponse.Page(
                JobResponse.SCHEMA_VERSION,
                jobs.find(status, sourceId, specId, (page - 1) * size, size).stream()
                        .map(JobResponse::from)
                        .toList(),
                page,
                size,
                jobs.count(status, sourceId, specId));
    }

    public JobResponse.Single get(String jobRunId) {
        return new JobResponse.Single(
                JobResponse.SCHEMA_VERSION,
                jobs.findById(jobRunId)
                        .map(JobResponse::from)
                        .orElseThrow(ResourceNotFoundException::new));
    }
}
