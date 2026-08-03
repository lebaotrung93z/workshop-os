package com.bosch.workshop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class WorkshopOsApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(WorkshopOsApiApplication.class, args);
	}

}
